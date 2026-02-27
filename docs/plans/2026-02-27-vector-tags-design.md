# 向量化智能标签系统设计

> 创建日期: 2026-02-27

## 概述

为 NexusNote 构建基于向量 Embedding 的智能标签系统，实现：

- **全自动标签生成** - 文档编辑时自动触发 AI 生成标签
- **语义标签匹配** - 标签拥有向量，自动合并语义相同的标签
- **置信度机制** - 低置信度标签需用户确认
- **零管理负担** - 无管理页面，一切 inline 交互

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户编辑文档                           │
└─────────────────────┬───────────────────────────────────┘
                      │ 防抖 5s + 变化 > 50字
                      ▼
┌─────────────────────────────────────────────────────────┐
│              TagGenerationService                        │
│  一次 AI 调用 → { tags: [...], confidence: [...] }       │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────────┐
   │  tags   │   │document_│   │ Embedding   │
   │  表     │   │  tags   │   │ (Qwen3)     │
   │         │   │  关联表 │   │ 异步生成     │
   └─────────┘   └─────────┘   └─────────────┘
```

**核心组件：**

| 组件 | 职责 |
|------|------|
| TagGenerationService | 统一的标签生成入口，协调 AI 调用、标签匹配、关联创建 |
| tags 表 | 存储标签实体：名称、向量、使用次数 |
| document_tags 表 | 文档-标签关联，包含置信度和确认状态 |

## 数据库设计

### tags 表

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_embedding halfvec(4000),  -- Qwen3 embedding
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_embedding ON tags
  USING ivfflat (name_embedding halfvec_cosine_ops)
  WITH (lists = 100);
```

### document_tags 表

```sql
CREATE TABLE document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  confidence FLOAT NOT NULL,  -- 0 ~ 1
  status VARCHAR(20) DEFAULT 'pending',  -- 'confirmed' | 'pending' | 'rejected'
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,

  UNIQUE(document_id, tag_id)
);

CREATE INDEX idx_document_tags_document ON document_tags(document_id);
CREATE INDEX idx_document_tags_status ON document_tags(status);
```

### Drizzle Schema

```typescript
// db/schema/tags.ts

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  nameEmbedding: halfvec('name_embedding', { dimensions: 4000 }),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const documentTags = pgTable('document_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  confidence: real('confidence').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
}, (table) => [
  unique().on(table.documentId, table.tagId),
])
```

## 标签生成服务

### 核心逻辑

```typescript
// lib/ai/services/tag-generation-service.ts

export class TagGenerationService {
  private aiProvider: AIProvider
  private embeddingService: EmbeddingService

  async generateTags(documentId: string): Promise<void> {
    // 1. 获取文档内容
    const content = await this.getDocumentContent(documentId)

    // 2. AI 生成标签
    const result = await this.aiProvider.streamText({
      model: 'gemini-3-flash',
      system: TAG_GENERATION_SYSTEM_PROMPT,
      prompt: `请为以下文档生成 3-5 个标签，返回 JSON 格式：
        { "tags": ["标签1", "标签2"], "confidence": [0.9, 0.6] }

        文档内容：
        ${content}`,
    })

    const { tags, confidence } = this.parseResult(result)

    // 3. 为每个标签建立关联
    for (let i = 0; i < tags.length; i++) {
      const tag = await this.findOrCreateTag(tags[i])
      await this.linkDocumentTag(documentId, tag.id, confidence[i])
    }
  }

  private async findOrCreateTag(tagName: string): Promise<Tag> {
    // 生成标签名 embedding
    const embedding = await this.embeddingService.embed(tagName)

    // 向量搜索：相似度 > 0.9 视为同一标签
    const existing = await db
      .select()
      .from(tags)
      .where(sql`cosine_distance(name_embedding, ${embedding}) < 0.1`)
      .limit(1)

    if (existing[0]) {
      // 增加使用计数
      await db.update(tags)
        .set({ usageCount: sql`usage_count + 1` })
        .where(eq(tags.id, existing[0].id))
      return existing[0]
    }

    // 创建新标签
    const [newTag] = await db.insert(tags)
      .values({ name: tagName, nameEmbedding: embedding, usageCount: 1 })
      .returning()

    return newTag
  }

  private async linkDocumentTag(
    documentId: string,
    tagId: string,
    confidence: number
  ): Promise<void> {
    const status = confidence >= 0.7 ? 'confirmed' : 'pending'

    await db.insert(documentTags)
      .values({
        documentId,
        tagId,
        confidence,
        status,
        confirmedAt: status === 'confirmed' ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [documentTags.documentId, documentTags.tagId],
        set: { confidence, status },
      })
  }
}
```

### 触发机制（前端）

```typescript
// components/editor/TagGenerationTrigger.tsx

import { useDebouncedCallback } from 'use-debounce'
import { generateDocumentTags } from '@/actions/tag-actions'

export function TagGenerationTrigger({ documentId, content }: Props) {
  const prevContentRef = useRef(content)

  const generateTags = useDebouncedCallback(async () => {
    const diff = Math.abs(content.length - prevContentRef.current.length)
    if (diff > 50) {
      await generateDocumentTags(documentId)
    }
    prevContentRef.current = content
  }, 5000)

  useEffect(() => {
    generateTags()
  }, [content, generateTags])

  return null
}
```

## UI 组件

### 文档顶部标签栏

```typescript
// components/document/TagBar.tsx

export async function TagBar({ documentId }: { documentId: string }) {
  const tags = await getDocumentTags(documentId)
  const confirmed = tags.filter(t => t.status === 'confirmed')
  const pending = tags.filter(t => t.status === 'pending')

  return (
    <div className="flex items-center gap-2 py-2">
      {/* 已确认标签 */}
      {confirmed.map(tag => (
        <TagBadge key={tag.id} tag={tag} />
      ))}

      {/* 待确认标签提示 */}
      {pending.length > 0 && (
        <PendingTagsPopover pending={pending} />
      )}
    </div>
  )
}
```

### 待确认标签弹窗

```typescript
// components/document/PendingTagsPopover.tsx

export function PendingTagsPopover({ pending }: { pending: DocumentTag[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant="secondary" className="cursor-pointer">
          + {pending.length} 建议待确认
        </Badge>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2">
          {pending.map(dt => (
            <div key={dt.id} className="flex items-center justify-between">
              <span>{dt.tag.name}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(dt.confidence * 100)}%
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirmTag(dt.id)}
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => rejectTag(dt.id)}
                >
                  ✗
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

## Server Actions

```typescript
// actions/tag-actions.ts

'use server'

// 触发标签生成
export async function generateDocumentTags(documentId: string) {
  return tagGenerationService.generateTags(documentId)
}

// 确认标签
export async function confirmTag(documentTagId: string) {
  return db.update(documentTags)
    .set({ status: 'confirmed', confirmedAt: new Date() })
    .where(eq(documentTags.id, documentTagId))
}

// 拒绝标签
export async function rejectTag(documentTagId: string) {
  return db.update(documentTags)
    .set({ status: 'rejected' })
    .where(eq(documentTags.id, documentTagId))
}

// 获取文档标签
export async function getDocumentTags(documentId: string) {
  const result = await db
    .select({
      id: documentTags.id,
      confidence: documentTags.confidence,
      status: documentTags.status,
      tag: tags,
    })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id))
    .where(
      and(
        eq(documentTags.documentId, documentId),
        ne(documentTags.status, 'rejected')
      )
    )

  return result
}
```

## AI Prompt

```typescript
// lib/ai/prompts/tag-generation.ts

export const TAG_GENERATION_SYSTEM_PROMPT = `
你是一个专业的知识标签生成助手。根据文档内容生成准确、简洁的标签。

规则：
1. 生成 3-5 个标签
2. 标签应该是具体的技术名词或领域概念
3. 优先选择文档中明确提到的关键词
4. 为每个标签提供 0-1 的置信度分数
5. 返回严格的 JSON 格式

示例输出：
{
  "tags": ["React", "前端开发", "组件设计"],
  "confidence": [0.95, 0.85, 0.72]
}
`
```

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 触发防抖时间 | 5000ms | 用户停止编辑后等待时间 |
| 内容变化阈值 | 50 字 | 触发生成的最小变化量 |
| 置信度阈值 | 0.7 | 高于此值自动确认 |
| 标签合并相似度 | 0.9 | 向量相似度高于此值视为同一标签 |
| 每次生成标签数 | 3-5 | AI 单次生成的标签数量 |

## 实现步骤

1. **数据库迁移** - 创建 tags 和 document_tags 表
2. **Drizzle Schema** - 添加表定义
3. **TagGenerationService** - 实现核心生成逻辑
4. **Server Actions** - 暴露服务端接口
5. **TagBar 组件** - 文档顶部标签展示
6. **PendingTagsPopover** - 待确认标签交互
7. **TagGenerationTrigger** - 前端触发器
8. **集成测试** - 端到端验证

## 未来扩展

- **标签筛选** - 在文档列表中按标签筛选
- **标签统计** - Dashboard 展示热门标签
- **层级聚类** - 自动发现标签层级关系（无需 UI 管理）

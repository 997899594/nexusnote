# 向量化智能标签系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建基于向量 Embedding 的智能标签系统，自动为文档生成标签，支持语义匹配和置信度确认流程。

**Architecture:** 文档编辑触发（防抖 + 阈值）→ TagGenerationService 调用 AI 生成标签 → 向量搜索匹配或创建标签 → 前端展示已确认/待确认标签。

**Tech Stack:** Drizzle ORM, AI SDK v6, pgvector, React 19, Radix UI

---

## Task 1: 数据库 Schema - tags 表

**Files:**
- Modify: `db/schema.ts`

**Step 1: 添加 tags 表定义**

在 `db/schema.ts` 的 `// ============================================` 注释区域添加新模块（建议在 documents 模块之后）：

```typescript
// ============================================
// 标签系统 (Tags System)
// ============================================

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    nameEmbedding: halfvec("name_embedding"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nameIdx: index("tags_name_idx").on(table.name),
  }),
);
```

**Step 2: 添加类型导出**

在类型导出区域添加：

```typescript
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
```

**Step 3: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过（可能有 halfvec 类型警告，忽略）

**Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat(db): add tags table schema"
```

---

## Task 2: 数据库 Schema - document_tags 关联表

**Files:**
- Modify: `db/schema.ts`

**Step 1: 添加 document_tags 表定义**

在 tags 表定义之后添加：

```typescript
export const documentTags = pgTable(
  "document_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    status: text("status").notNull().default("pending"), // 'confirmed' | 'pending' | 'rejected'
    createdAt: timestamp("created_at").defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => ({
    documentIdx: index("document_tags_document_idx").on(table.documentId),
    statusIdx: index("document_tags_status_idx").on(table.status),
    uniqueDocumentTag: index("document_tags_unique_idx").on(table.documentId, table.tagId),
  }),
);
```

**Step 2: 添加类型导出**

```typescript
export type DocumentTag = typeof documentTags.$inferSelect;
export type NewDocumentTag = typeof documentTags.$inferInsert;
```

**Step 3: 添加 Relations**

在 Relations 区域添加：

```typescript
export const tagsRelations = relations(tags, ({ many }) => ({
  documentTags: many(documentTags),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(documents, {
    fields: [documentTags.documentId],
    references: [documents.id],
  }),
  tag: one(tags, {
    fields: [documentTags.tagId],
    references: [tags.id],
  }),
}));

// 更新 documentsRelations
export const documentsRelations = relations(documents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [documents.workspaceId],
    references: [workspaces.id],
  }),
  tags: many(documentTags), // 添加这行
}));
```

**Step 4: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 5: Commit**

```bash
git add db/schema.ts
git commit -m "feat(db): add document_tags relation table"
```

---

## Task 3: 推送数据库迁移

**Files:**
- Generate: `drizzle/*.sql` (自动生成)

**Step 1: 生成迁移文件**

```bash
bun run db:generate
```

Expected: 生成新的迁移 SQL 文件

**Step 2: 修复 halfvec 类型（Drizzle bug）**

```bash
sed -i '' 's/"halfvec(4000)"/halfvec(4000)/g' drizzle/*.sql
```

**Step 3: 推送到数据库**

```bash
bun run db:push
```

Expected: 表创建成功

**Step 4: 验证表结构**

```bash
bun run db:studio
```

在浏览器中检查 tags 和 document_tags 表是否存在。

**Step 5: Commit 迁移文件**

```bash
git add drizzle/
git commit -m "feat(db): migrate tags and document_tags tables"
```

---

## Task 4: AI Prompt - 标签生成

**Files:**
- Create: `lib/ai/prompts/tag-generation.ts`

**Step 1: 创建 Prompt 文件**

```typescript
/**
 * Tag Generation Prompt
 *
 * 用于从文档内容生成智能标签
 */

export const TAG_GENERATION_SYSTEM_PROMPT = `你是一个专业的知识标签生成助手。根据文档内容生成准确、简洁的标签。

规则：
1. 生成 3-5 个标签
2. 标签应该是具体的技术名词或领域概念
3. 优先选择文档中明确提到的关键词
4. 为每个标签提供 0-1 的置信度分数
5. 返回严格的 JSON 格式，不要有其他文字

返回格式示例：
{"tags": ["React", "前端开发", "组件设计"], "confidence": [0.95, 0.85, 0.72]}`;

export const TAG_GENERATION_USER_PROMPT = (content: string) => `请为以下文档生成标签：

${content.slice(0, 3000)}`;

// Zod schema for validation
import { z } from "zod";

export const TagGenerationResultSchema = z.object({
  tags: z.array(z.string()).min(1).max(5),
  confidence: z.array(z.number().min(0).max(1)),
});

export type TagGenerationResult = z.infer<typeof TagGenerationResultSchema>;
```

**Step 2: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 3: Commit**

```bash
git add lib/ai/prompts/tag-generation.ts
git commit -m "feat(ai): add tag generation prompt"
```

---

## Task 5: TagGenerationService - 核心服务

**Files:**
- Create: `lib/ai/services/tag-generation-service.ts`

**Step 1: 创建服务文件**

```typescript
/**
 * Tag Generation Service
 *
 * 自动为文档生成智能标签，支持：
 * - AI 生成标签 + 置信度
 * - 向量搜索匹配相似标签
 * - 自动合并语义相同的标签
 */

import { embed } from "ai";
import { eq, and, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, documentTags, tags } from "@/db/schema";
import { aiProvider, safeGenerateObject } from "@/lib/ai";
import {
  TAG_GENERATION_SYSTEM_PROMPT,
  TAG_GENERATION_USER_PROMPT,
  TagGenerationResultSchema,
  type TagGenerationResult,
} from "../prompts/tag-generation";

// 配置参数
const CONFIG = {
  /** 标签合并相似度阈值（余弦距离 < 0.1 视为相同） */
  TAG_MERGE_THRESHOLD: 0.1,
  /** 自动确认的置信度阈值 */
  AUTO_CONFIRM_THRESHOLD: 0.7,
  /** 单个标签最大长度 */
  MAX_TAG_LENGTH: 100,
} as const;

class TagGenerationService {
  /**
   * 为文档生成标签
   */
  async generateTags(documentId: string): Promise<void> {
    // 1. 获取文档内容
    const content = await this.getDocumentContent(documentId);
    if (!content || content.length < 50) {
      console.log(`[Tags] 文档 ${documentId} 内容过短，跳过标签生成`);
      return;
    }

    // 2. AI 生成标签
    const result = await this.generateTagsWithAI(content);

    // 3. 为每个标签建立关联
    for (let i = 0; i < result.tags.length; i++) {
      const tagName = result.tags[i];
      const confidence = result.confidence[i] ?? 0.5;

      try {
        const tag = await this.findOrCreateTag(tagName);
        await this.linkDocumentTag(documentId, tag.id, confidence);
      } catch (error) {
        console.error(`[Tags] 处理标签 "${tagName}" 失败:`, error);
      }
    }

    console.log(`[Tags] 文档 ${documentId} 生成 ${result.tags.length} 个标签`);
  }

  /**
   * 获取文档纯文本内容
   */
  private async getDocumentContent(documentId: string): Promise<string | null> {
    const [doc] = await db
      .select({ plainText: documents.plainText })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    return doc?.plainText ?? null;
  }

  /**
   * 调用 AI 生成标签
   */
  private async generateTagsWithAI(content: string): Promise<TagGenerationResult> {
    if (!aiProvider.isConfigured()) {
      throw new Error("AI Provider not configured");
    }

    const result = await safeGenerateObject({
      schema: TagGenerationResultSchema,
      model: aiProvider.chatModel,
      system: TAG_GENERATION_SYSTEM_PROMPT,
      prompt: TAG_GENERATION_USER_PROMPT(content),
      temperature: 0.3,
      maxRetries: 2,
    });

    // 验证 tags 和 confidence 数量匹配
    if (result.tags.length !== result.confidence.length) {
      // 补齐缺失的置信度
      while (result.confidence.length < result.tags.length) {
        result.confidence.push(0.5);
      }
    }

    return result;
  }

  /**
   * 查找或创建标签（支持向量语义匹配）
   */
  private async findOrCreateTag(tagName: string): Promise<typeof tags.$inferSelect> {
    const normalizedName = tagName.trim().slice(0, CONFIG.MAX_TAG_LENGTH);

    // 1. 先精确匹配名称
    const [exactMatch] = await db
      .select()
      .from(tags)
      .where(eq(tags.name, normalizedName))
      .limit(1);

    if (exactMatch) {
      await this.incrementTagUsage(exactMatch.id);
      return exactMatch;
    }

    // 2. 生成 embedding
    const embedding = await this.generateEmbedding(normalizedName);

    // 3. 向量搜索相似标签
    const [similarTag] = await db
      .select()
      .from(tags)
      .where(
        and(
          sql`embedding IS NOT NULL`,
          sql`cosine_distance(name_embedding, ${JSON.stringify(embedding)}) < ${CONFIG.TAG_MERGE_THRESHOLD}`
        )
      )
      .limit(1);

    if (similarTag) {
      console.log(`[Tags] 标签 "${normalizedName}" 合并到相似标签 "${similarTag.name}"`);
      await this.incrementTagUsage(similarTag.id);
      return similarTag;
    }

    // 4. 创建新标签
    const [newTag] = await db
      .insert(tags)
      .values({
        name: normalizedName,
        nameEmbedding: embedding,
        usageCount: 1,
      })
      .returning();

    return newTag;
  }

  /**
   * 生成文本 embedding
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!aiProvider.isConfigured()) {
      throw new Error("AI Provider not configured");
    }

    const { embedding } = await embed({
      model: aiProvider.embeddingModel as any,
      value: text,
    });

    return embedding;
  }

  /**
   * 增加标签使用计数
   */
  private async incrementTagUsage(tagId: string): Promise<void> {
    await db
      .update(tags)
      .set({
        usageCount: sql`${tags.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tags.id, tagId));
  }

  /**
   * 关联文档和标签
   */
  private async linkDocumentTag(
    documentId: string,
    tagId: string,
    confidence: number
  ): Promise<void> {
    const status = confidence >= CONFIG.AUTO_CONFIRM_THRESHOLD ? "confirmed" : "pending";
    const confirmedAt = status === "confirmed" ? new Date() : null;

    await db
      .insert(documentTags)
      .values({
        documentId,
        tagId,
        confidence,
        status,
        confirmedAt,
      })
      .onConflictDoUpdate({
        target: [documentTags.documentId, documentTags.tagId],
        set: {
          confidence,
          status,
          confirmedAt,
        },
      });
  }
}

// 导出单例
export const tagGenerationService = new TagGenerationService();
```

**Step 2: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 3: Commit**

```bash
git add lib/ai/services/tag-generation-service.ts
git commit -m "feat(ai): add tag generation service with embedding support"
```

---

## Task 6: API Route - 标签操作

**Files:**
- Create: `app/api/documents/[id]/tags/route.ts`

**Step 1: 创建 API 路由文件**

```typescript
/**
 * Document Tags API
 *
 * GET  - 获取文档的所有标签
 * POST - 触发标签生成
 */

import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentTags, tags } from "@/db/schema";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id]/tags
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: documentId } = await params;

  try {
    const result = await db
      .select({
        id: documentTags.id,
        confidence: documentTags.confidence,
        status: documentTags.status,
        confirmedAt: documentTags.confirmedAt,
        tag: {
          id: tags.id,
          name: tags.name,
          usageCount: tags.usageCount,
        },
      })
      .from(documentTags)
      .innerJoin(tags, eq(documentTags.tagId, tags.id))
      .where(
        and(eq(documentTags.documentId, documentId), ne(documentTags.status, "rejected"))
      )
      .orderBy(tags.usageCount);

    return NextResponse.json({ tags: result });
  } catch (error) {
    console.error("[API] 获取标签失败:", error);
    return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
  }
}

// POST /api/documents/[id]/tags
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: documentId } = await params;

  try {
    await tagGenerationService.generateTags(documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] 生成标签失败:", error);
    return NextResponse.json({ error: "生成标签失败" }, { status: 500 });
  }
}
```

**Step 2: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 3: Commit**

```bash
git add app/api/documents/[id]/tags/route.ts
git commit -m "feat(api): add document tags endpoints"
```

---

## Task 7: API Route - 标签确认/拒绝

**Files:**
- Create: `app/api/document-tags/[id]/route.ts`

**Step 1: 创建 API 路由文件**

```typescript
/**
 * Document Tag Operations API
 *
 * PATCH - 确认或拒绝标签
 * DELETE - 删除标签关联
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentTags } from "@/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/document-tags/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: documentTagId } = await params;

  try {
    const body = await request.json();
    const { status } = body as { status: "confirmed" | "rejected" };

    if (!["confirmed", "rejected"].includes(status)) {
      return NextResponse.json({ error: "无效的 status 值" }, { status: 400 });
    }

    const updateData =
      status === "confirmed"
        ? { status, confirmedAt: new Date() }
        : { status, confirmedAt: null };

    const [updated] = await db
      .update(documentTags)
      .set(updateData)
      .where(eq(documentTags.id, documentTagId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "标签关联不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, documentTag: updated });
  } catch (error) {
    console.error("[API] 更新标签状态失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/document-tags/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: documentTagId } = await params;

  try {
    const [deleted] = await db
      .delete(documentTags)
      .where(eq(documentTags.id, documentTagId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "标签关联不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] 删除标签关联失败:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
```

**Step 2: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 3: Commit**

```bash
git add app/api/document-tags/[id]/route.ts
git commit -m "feat(api): add document tag confirm/reject endpoints"
```

---

## Task 8: UI 组件 - TagBadge

**Files:**
- Create: `components/tags/TagBadge.tsx`

**Step 1: 创建 TagBadge 组件**

```typescript
/**
 * TagBadge - 单个标签徽章组件
 */

"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface TagBadgeProps {
  name: string;
  onRemove?: () => void;
  removable?: boolean;
}

export function TagBadge({ name, onRemove, removable = false }: TagBadgeProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      await onRemove();
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-secondary text-secondary-foreground rounded-md">
      {name}
      {removable && (
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="ml-1 hover:bg-secondary-foreground/20 rounded-sm p-0.5 transition-colors"
          aria-label="移除标签"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
```

**Step 2: 创建组件目录索引**

```typescript
// components/tags/index.ts
export { TagBadge } from "./TagBadge";
```

**Step 3: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 4: Commit**

```bash
git add components/tags/
git commit -m "feat(ui): add TagBadge component"
```

---

## Task 9: UI 组件 - PendingTagsPopover

**Files:**
- Create: `components/tags/PendingTagsPopover.tsx`

**Step 1: 创建 PendingTagsPopover 组件**

```typescript
/**
 * PendingTagsPopover - 待确认标签弹窗
 */

"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

interface PendingTag {
  id: string;
  confidence: number;
  tag: {
    id: string;
    name: string;
  };
}

interface PendingTagsPopoverProps {
  pending: PendingTag[];
  onConfirm: (documentTagId: string) => Promise<void>;
  onReject: (documentTagId: string) => Promise<void>;
}

export function PendingTagsPopover({
  pending,
  onConfirm,
  onReject,
}: PendingTagsPopoverProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleConfirm = async (documentTagId: string) => {
    setLoadingId(documentTagId);
    try {
      await onConfirm(documentTagId);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (documentTagId: string) => {
    setLoadingId(documentTagId);
    try {
      await onReject(documentTagId);
    } finally {
      setLoadingId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-secondary transition-colors"
        >
          + {pending.length} 建议待确认
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            AI 建议的标签
          </p>
          {pending.map((dt) => (
            <div
              key={dt.id}
              className="flex items-center justify-between py-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{dt.tag.name}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(dt.confidence * 100)}%
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleConfirm(dt.id)}
                  disabled={loadingId === dt.id}
                  aria-label="确认标签"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleReject(dt.id)}
                  disabled={loadingId === dt.id}
                  aria-label="拒绝标签"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: 更新索引文件**

```typescript
// components/tags/index.ts
export { TagBadge } from "./TagBadge";
export { PendingTagsPopover } from "./PendingTagsPopover";
```

**Step 3: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 4: Commit**

```bash
git add components/tags/
git commit -m "feat(ui): add PendingTagsPopover component"
```

---

## Task 10: UI 组件 - TagBar

**Files:**
- Create: `components/tags/TagBar.tsx`

**Step 1: 创建 TagBar 组件**

```typescript
/**
 * TagBar - 文档顶部标签栏
 *
 * 展示已确认标签 + 待确认标签入口
 */

"use client";

import { useEffect, useState } from "react";
import { TagBadge, PendingTagsPopover } from "./index";

interface DocumentTag {
  id: string;
  confidence: number;
  status: string;
  confirmedAt: string | null;
  tag: {
    id: string;
    name: string;
    usageCount: number;
  };
}

interface TagBarProps {
  documentId: string;
}

export function TagBar({ documentId }: TagBarProps) {
  const [tags, setTags] = useState<DocumentTag[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取标签
  const fetchTags = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/tags`);
      const data = await res.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error("[TagBar] 获取标签失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [documentId]);

  // 确认标签
  const handleConfirm = async (documentTagId: string) => {
    await fetch(`/api/document-tags/${documentTagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    await fetchTags();
  };

  // 拒绝标签
  const handleReject = async (documentTagId: string) => {
    await fetch(`/api/document-tags/${documentTagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    await fetchTags();
  };

  // 移除标签（实际上是拒绝）
  const handleRemove = async (documentTagId: string) => {
    await fetch(`/api/document-tags/${documentTagId}`, {
      method: "DELETE",
    });
    await fetchTags();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="h-6 w-16 bg-muted animate-pulse rounded-md" />
        <div className="h-6 w-12 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  const confirmed = tags.filter((t) => t.status === "confirmed");
  const pending = tags.filter((t) => t.status === "pending");

  if (confirmed.length === 0 && pending.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {/* 已确认标签 */}
      {confirmed.map((dt) => (
        <TagBadge
          key={dt.id}
          name={dt.tag.name}
          removable
          onRemove={() => handleRemove(dt.id)}
        />
      ))}

      {/* 待确认标签 */}
      <PendingTagsPopover
        pending={pending}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </div>
  );
}
```

**Step 2: 更新索引文件**

```typescript
// components/tags/index.ts
export { TagBadge } from "./TagBadge";
export { PendingTagsPopover } from "./PendingTagsPopover";
export { TagBar } from "./TagBar";
```

**Step 3: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 4: Commit**

```bash
git add components/tags/
git commit -m "feat(ui): add TagBar component for document header"
```

---

## Task 11: 集成 - 文档页面添加 TagBar

**Files:**
- Modify: 文档详情页面（需确认具体路径）

**Step 1: 找到文档详情页面**

```bash
# 查找文档详情页面
find app -name "page.tsx" | xargs grep -l "document" | head -5
```

**Step 2: 在页面中导入并使用 TagBar**

```typescript
import { TagBar } from "@/components/tags";

// 在文档标题下方添加
<TagBar documentId={documentId} />
```

**Step 3: 验证 UI 渲染**

```bash
bun dev
```

访问文档页面，检查标签栏是否正确显示。

**Step 4: Commit**

```bash
git add app/
git commit -m "feat(ui): integrate TagBar into document page"
```

---

## Task 12: 前端触发器 - TagGenerationTrigger

**Files:**
- Create: `components/tags/TagGenerationTrigger.tsx`

**Step 1: 创建触发器组件**

```typescript
/**
 * TagGenerationTrigger - 标签自动生成触发器
 *
 * 监听文档内容变化，满足条件时触发生成：
 * - 防抖 5 秒
 * - 内容变化 > 50 字
 */

"use client";

import { useEffect, useRef } from "react";

interface TagGenerationTriggerProps {
  documentId: string;
  content: string;
}

export function TagGenerationTrigger({
  documentId,
  content,
}: TagGenerationTriggerProps) {
  const prevContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const diff = Math.abs(content.length - prevContentRef.current.length);

    // 变化量不足，不触发
    if (diff < 50) {
      return;
    }

    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 5 秒防抖后触发生成
    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/documents/${documentId}/tags`, {
          method: "POST",
        });
        console.log("[Tags] 触发标签生成");
      } catch (error) {
        console.error("[Tags] 生成失败:", error);
      }
      prevContentRef.current = content;
    }, 5000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [documentId, content]);

  return null;
}
```

**Step 2: 更新索引文件**

```typescript
// components/tags/index.ts
export { TagBadge } from "./TagBadge";
export { PendingTagsPopover } from "./PendingTagsPopover";
export { TagBar } from "./TagBar";
export { TagGenerationTrigger } from "./TagGenerationTrigger";
```

**Step 3: 运行类型检查**

```bash
bun run typecheck
```

Expected: 通过

**Step 4: Commit**

```bash
git add components/tags/
git commit -m "feat(ui): add TagGenerationTrigger for auto tag generation"
```

---

## Task 13: 集成测试

**Step 1: 启动开发服务器**

```bash
bun dev
```

**Step 2: 手动测试流程**

1. 创建/编辑一篇文档，输入超过 50 字的内容
2. 停止编辑，等待 5 秒
3. 检查控制台是否有 `[Tags] 触发标签生成` 日志
4. 刷新页面，检查标签是否显示在文档顶部
5. 点击待确认标签，确认/拒绝
6. 再次编辑内容，验证新标签生成

**Step 3: 检查数据库**

```bash
bun run db:studio
```

验证 tags 和 document_tags 表数据正确。

**Step 4: 记录测试结果**

在 commit message 中记录测试通过。

**Step 5: Final Commit**

```bash
git add .
git commit -m "feat: complete vector-based smart tags system

- Add tags and document_tags database schema
- Implement TagGenerationService with embedding support
- Add API endpoints for tag operations
- Create TagBar, TagBadge, PendingTagsPopover components
- Integrate TagGenerationTrigger for auto generation

Tested: tag generation, confirmation flow, UI display"
```

---

## 实现顺序总结

1. **Task 1-3**: 数据库层（Schema + 迁移）
2. **Task 4-5**: AI 服务层（Prompt + Service）
3. **Task 6-7**: API 层（Routes）
4. **Task 8-10**: UI 组件层（TagBadge → Popover → TagBar）
5. **Task 11**: 页面集成
6. **Task 12-13**: 触发器 + 测试

每个 Task 都是一次 commit，保持原子性，便于回滚和 review。

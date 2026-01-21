# 技术需求文档 (TRD): NexusNote 技术架构规范

| 文档属性 | 内容 |
| :--- | :--- |
| **版本号** | v2.0.0 |
| **状态** | **已批准** |
| **最后更新** | 2025-01 |

---

## 1. 架构概述

### 1.1 设计原则
| 原则 | 说明 |
|------|------|
| **Local-First** | 数据优先存储在客户端，离线可用 |
| **工业级组件** | 使用成熟库（Tiptap、Yjs），不造轮子 |
| **类型安全** | 端到端 TypeScript，tRPC 类型推导 |
| **流式优先** | AI 交互全部采用流式响应 |

### 1.2 技术栈总览

```
┌─────────────────────────────────────────────────────────────────┐
│                         NexusNote                               │
├─────────────────────────────────────────────────────────────────┤
│  前端 (apps/web)                                                │
│  ├── 框架: Next.js 14 (App Router)                              │
│  ├── 编辑器: Tiptap v2 (基于 Prosemirror)                        │
│  ├── 协同绑定: y-prosemirror                                    │
│  ├── 离线存储: y-indexeddb                                      │
│  ├── 状态管理: Jotai                                            │
│  ├── 样式: Tailwind CSS                                         │
│  └── AI 客户端: @ai-sdk/react (useChat, useCompletion)          │
├─────────────────────────────────────────────────────────────────┤
│  通信层                                                          │
│  ├── 实时协同: WebSocket (Hocuspocus Provider)                  │
│  └── 业务 API: tRPC                                             │
├─────────────────────────────────────────────────────────────────┤
│  后端 (apps/server)                                             │
│  ├── 框架: NestJS                                               │
│  ├── 协同服务: Hocuspocus Server (独立端口)                      │
│  ├── 业务 API: tRPC Router                                      │
│  ├── AI 服务: @ai-sdk/openai (streamText)                       │
│  └── 任务队列: BullMQ (RAG 索引)                                │
├─────────────────────────────────────────────────────────────────┤
│  数据层                                                          │
│  ├── 主库: PostgreSQL                                           │
│  ├── ORM: Drizzle                                               │
│  ├── 向量: pgvector                                             │
│  └── 队列: Redis                                                │
├─────────────────────────────────────────────────────────────────┤
│  基础设施                                                        │
│  ├── Monorepo: Turborepo                                        │
│  ├── 包管理: pnpm                                               │
│  ├── 代码规范: Biome                                            │
│  └── 容器化: Docker (Multi-stage Build)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 项目结构

```
nexusnote/
├── apps/
│   ├── web/                    # Next.js 前端
│   │   ├── app/               # App Router 页面
│   │   │   ├── api/           # API Routes
│   │   │   │   ├── chat/      # AI 对话接口
│   │   │   │   └── completion/# AI 补全接口
│   │   │   ├── editor/        # 编辑器页面
│   │   │   └── layout.tsx
│   │   ├── components/        # React 组件
│   │   │   ├── editor/        # 编辑器组件
│   │   │   ├── ai/            # AI 相关组件
│   │   │   └── ui/            # 通用 UI
│   │   └── lib/               # 工具库
│   │
│   └── server/                 # NestJS 后端
│       ├── src/
│       │   ├── collaboration/ # Hocuspocus 模块
│       │   ├── ai/            # AI 服务模块
│       │   ├── document/      # 文档业务模块
│       │   └── trpc/          # tRPC Router
│       └── main.ts
│
├── packages/
│   ├── db/                     # Drizzle Schema + 迁移
│   ├── api/                    # tRPC 定义 (共享类型)
│   └── ui/                     # 共享 UI 组件
│
├── docs/
│   ├── PRD.md
│   └── TRD.md
│
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 2. 核心模块技术规范

### 2.1 编辑器模块 (Tiptap)

#### 2.1.1 技术选型理由
| 方案 | 评估 | 结论 |
|------|------|------|
| Slate.js | 与 CRDT 绑定不稳定，复杂嵌套场景有 bug | ❌ 不采用 |
| Lexical | 较新，文档学习曲线陡 | ⚠️ 备选 |
| **Tiptap** | Prosemirror 封装，`y-prosemirror` 最稳健 | ✅ **采用** |

#### 2.1.2 核心依赖
```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-collaboration": "^2.x",
  "@tiptap/extension-collaboration-cursor": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "yjs": "^13.x",
  "y-prosemirror": "^1.x",
  "y-indexeddb": "^9.x"
}
```

#### 2.1.3 编辑器初始化
```typescript
// apps/web/components/editor/Editor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

export function Editor({ documentId }: { documentId: string }) {
  const ydoc = useMemo(() => new Y.Doc(), [])

  const provider = useMemo(() =>
    new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_COLLAB_URL!,
      name: documentId,
      document: ydoc,
      token: 'jwt-token-here', // 从 auth 获取
    }), [documentId, ydoc]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // 禁用内置 history，用 Yjs
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: 'User', color: '#ff0000' },
      }),
    ],
  })

  return <EditorContent editor={editor} />
}
```

#### 2.1.4 离线存储
```typescript
// 自动同步到 IndexedDB
import { IndexeddbPersistence } from 'y-indexeddb'

const persistence = new IndexeddbPersistence(documentId, ydoc)

persistence.on('synced', () => {
  console.log('Content loaded from IndexedDB')
})
```

### 2.2 协同服务模块 (Hocuspocus)

#### 2.2.1 架构决策
| 决策点 | 方案 | 理由 |
|--------|------|------|
| 部署方式 | **独立端口** (开发) / **独立服务** (生产) | 避免与 NestJS Gateway 冲突 |
| 端口分配 | NestJS: 3001, Hocuspocus: 1234 | 清晰隔离 |
| 持久化 | Hocuspocus → Drizzle → PostgreSQL | 统一数据层 |

#### 2.2.2 服务端实现
```typescript
// apps/server/src/collaboration/hocuspocus.service.ts
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { db } from '@nexusnote/db'
import { documents } from '@nexusnote/db/schema'

export const hocuspocusServer = Server.configure({
  port: 1234,

  async onAuthenticate({ token, documentName }) {
    // JWT 验证
    const user = await verifyJWT(token)
    if (!user) throw new Error('Unauthorized')

    // 返回用户信息，注入 Awareness
    return { user: { id: user.id, name: user.name } }
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await db.query.documents.findFirst({
          where: eq(documents.id, documentName)
        })
        return doc?.content ?? null // Uint8Array
      },

      store: async ({ documentName, state }) => {
        await db.update(documents)
          .set({ content: state, updatedAt: new Date() })
          .where(eq(documents.id, documentName))
      },
    }),
  ],

  // RAG 索引触发点（防抖处理）
  async onChange({ documentName }) {
    await debouncedIndexDocument(documentName)
  },
})
```

#### 2.2.3 客户端 Provider 配置
```typescript
// apps/web/lib/collaboration.ts
import { HocuspocusProvider } from '@hocuspocus/provider'

export function createProvider(documentId: string, ydoc: Y.Doc, token: string) {
  return new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_COLLAB_URL!, // ws://localhost:1234
    name: documentId,
    document: ydoc,
    token,

    onAuthenticationFailed: () => {
      console.error('Auth failed, redirecting to login')
    },

    onSynced: () => {
      console.log('Document synced with server')
    },
  })
}
```

### 2.3 AI 服务模块

#### 2.3.1 技术栈
```json
{
  "ai": "^3.x",
  "@ai-sdk/openai": "^0.x",
  "@ai-sdk/react": "^0.x"
}
```

#### 2.3.2 Chat API (侧边栏对话)
```typescript
// apps/web/app/api/chat/route.ts
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export const runtime = 'edge' // 低延迟

export async function POST(req: Request) {
  const { messages, documentContext } = await req.json()

  // 可选：注入当前文档上下文
  const systemPrompt = documentContext
    ? `你是 NexusNote 助手。当前文档内容：\n${documentContext}\n\n请基于文档内容回答。`
    : '你是 NexusNote 助手，帮助用户写作和整理知识。'

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
    maxTokens: 2000,
  })

  return result.toDataStreamResponse()
}
```

#### 2.3.3 Completion API (内联写作)
```typescript
// apps/web/app/api/completion/route.ts
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

const PROMPTS = {
  continue: '继续写作，保持风格一致：',
  improve: '润色以下文本，保持原意：',
  shorter: '缩写以下内容，保留关键信息：',
  longer: '扩展以下内容，增加细节：',
  translate_en: '翻译成英文：',
  translate_zh: '翻译成中文：',
  fix: '修正拼写和语法错误：',
}

export async function POST(req: Request) {
  const { prompt, action, selection } = await req.json()

  const instruction = PROMPTS[action as keyof typeof PROMPTS] || ''
  const fullPrompt = `${instruction}\n\n${selection || prompt}`

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    prompt: fullPrompt,
    maxTokens: 1000,
  })

  return result.toDataStreamResponse()
}
```

#### 2.3.4 前端 Hook 使用
```typescript
// 侧边栏对话
import { useChat } from '@ai-sdk/react'

export function ChatSidebar() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } =
    useChat({ api: '/api/chat' })

  return (
    <div>
      {messages.map(m => <Message key={m.id} {...m} />)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        {isLoading && <button onClick={stop}>停止</button>}
      </form>
    </div>
  )
}
```

```typescript
// 内联补全
import { useCompletion } from '@ai-sdk/react'

export function useInlineAI() {
  const { complete, completion, isLoading, stop } = useCompletion({
    api: '/api/completion',
  })

  const improve = (text: string) => complete(text, { body: { action: 'improve' } })
  const translate = (text: string, lang: string) =>
    complete(text, { body: { action: `translate_${lang}` } })

  return { improve, translate, completion, isLoading, stop }
}
```

#### 2.3.5 StreamingNode 实现
```typescript
// apps/web/components/editor/extensions/StreamingNode.ts
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { StreamingNodeView } from './StreamingNodeView'

export const StreamingNode = Node.create({
  name: 'streaming',
  group: 'block',
  atom: true,           // 原子节点，不可分割
  selectable: false,    // 不可选中
  draggable: false,

  addAttributes() {
    return {
      content: { default: '' },
      status: { default: 'loading' }, // loading | complete | error
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-streaming]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-streaming': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(StreamingNodeView)
  },
})
```

```typescript
// 流式插入控制器
export function useStreamingInsert(editor: Editor) {
  const insertStreaming = async (action: string, selection: string) => {
    // 1. 插入占位节点
    editor.chain().focus().insertContent({
      type: 'streaming',
      attrs: { content: '', status: 'loading' }
    }).run()

    // 2. 流式更新
    const response = await fetch('/api/completion', {
      method: 'POST',
      body: JSON.stringify({ action, selection }),
    })

    const reader = response.body?.getReader()
    let accumulated = ''

    while (true) {
      const { done, value } = await reader!.read()
      if (done) break

      accumulated += new TextDecoder().decode(value)

      // 更新节点属性（不改结构，避免 CRDT 冲突）
      editor.commands.updateAttributes('streaming', { content: accumulated })
    }

    // 3. 替换为普通文本
    editor.commands.updateAttributes('streaming', { status: 'complete' })
    // 延迟后替换
    setTimeout(() => {
      editor.chain()
        .focus()
        .deleteNode('streaming')
        .insertContent(accumulated)
        .run()
    }, 500)
  }

  return { insertStreaming }
}
```

### 2.4 RAG 模块

#### 2.4.1 架构设计
```
┌─────────────────────────────────────────────────────────────┐
│                      RAG Pipeline                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Hocuspocus onChange] ──debounce 10s──> [Redis Queue]     │
│                                                ↓            │
│                                         [BullMQ Worker]     │
│                                                ↓            │
│  [Postgres] <──────────────────────── [Embedding API]       │
│      ↓                                                      │
│  [pgvector] <─── cosine similarity ─── [User Query]         │
│      ↓                                                      │
│  [Top-K Chunks] ──> [Prompt Assembly] ──> [LLM] ──> [响应]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.4.2 数据库 Schema
```typescript
// packages/db/schema.ts
import { pgTable, uuid, text, timestamp, vector } from 'drizzle-orm/pg-core'

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: bytea('content'), // Yjs 二进制状态
  plainText: text('plain_text'), // 用于全文搜索/RAG
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embedding
  chunkIndex: integer('chunk_index').notNull(),
})

// 创建 HNSW 索引
// CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

#### 2.4.3 索引 Worker
```typescript
// apps/server/src/ai/rag.worker.ts
import { Worker } from 'bullmq'
import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'

const ragWorker = new Worker('rag-index', async (job) => {
  const { documentId } = job.data

  // 1. 获取文档纯文本
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId)
  })
  if (!doc?.plainText) return

  // 2. 分块 (简单按段落，生产可用更智能的分块)
  const chunks = splitIntoChunks(doc.plainText, { maxLength: 500, overlap: 50 })

  // 3. 批量 Embedding
  const embeddings = await Promise.all(
    chunks.map(chunk => embed({
      model: openai.embedding('text-embedding-3-small'),
      value: chunk,
    }))
  )

  // 4. 清除旧 chunks，插入新的
  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))
  await db.insert(documentChunks).values(
    chunks.map((content, i) => ({
      documentId,
      content,
      embedding: embeddings[i].embedding,
      chunkIndex: i,
    }))
  )
}, { connection: redis })
```

#### 2.4.4 检索 + 生成
```typescript
// apps/web/app/api/chat/route.ts (增强版)
export async function POST(req: Request) {
  const { messages, enableRAG } = await req.json()

  let context = ''

  if (enableRAG) {
    const lastMessage = messages[messages.length - 1].content

    // 查询相关文档
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: lastMessage,
    })

    const relevantChunks = await db.execute(sql`
      SELECT content, 1 - (embedding <=> ${embedding}) as similarity
      FROM document_chunks
      ORDER BY embedding <=> ${embedding}
      LIMIT 5
    `)

    context = relevantChunks.map(c => c.content).join('\n\n---\n\n')
  }

  const systemPrompt = context
    ? `你是 NexusNote 知识库助手。参考以下笔记内容回答：\n\n${context}`
    : '你是 NexusNote 助手。'

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
  })

  return result.toDataStreamResponse()
}
```

---

## 3. 基础设施

### 3.1 Turborepo 配置
```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 3.2 Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: nexusnote
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - "3001:3001"  # NestJS API
      - "1234:1234"  # Hocuspocus
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

### 3.3 环境变量
```bash
# .env.local (前端)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234

# .env (后端)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexusnote
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-xxx
JWT_SECRET=your-secret-key
```

---

## 4. 安全规范

### 4.1 API 安全
| 层面 | 措施 |
|------|------|
| API Key | 仅存于服务端 `.env`，严禁前端暴露 |
| JWT | 所有 API 和 WebSocket 需验证 token |
| CORS | 限制允许的 origin |
| Rate Limit | AI 接口限流，防止滥用 |

### 4.2 WebSocket 鉴权
```typescript
// Hocuspocus onAuthenticate
async onAuthenticate({ token }) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!)
    return { user: payload }
  } catch {
    throw new Error('Invalid token')
  }
}
```

### 4.3 AI 安全
- System Prompt 加入防护指令
- 不执行用户要求的"忽略指令"类请求
- 敏感操作需二次确认

---

## 5. 性能优化

### 5.1 前端优化
| 优化点 | 方案 |
|--------|------|
| Wasm 加载 | `WebAssembly.instantiateStreaming` 流式编译 |
| Bundle 大小 | 动态 import Tiptap 扩展 |
| 离线缓存 | IndexedDB + Service Worker |

### 5.2 后端优化
| 优化点 | 方案 |
|--------|------|
| AI 接口 | Edge Runtime 降低冷启动 |
| RAG 索引 | 队列异步处理，不阻塞协同 |
| 数据库 | pgvector HNSW 索引 |

### 5.3 协同优化
| 优化点 | 方案 |
|--------|------|
| 更新频率 | Yjs 自动批量合并微小更新 |
| 二进制传输 | Yjs Update 是紧凑二进制格式 |
| 断线重连 | HocuspocusProvider 内置重连机制 |

---

## 6. 监控与可观测性

### 6.1 关键指标
| 指标 | 采集方式 | 报警阈值 |
|------|----------|----------|
| WebSocket 连接数 | Hocuspocus metrics | > 1000 |
| AI API 延迟 | OpenTelemetry | P99 > 3s |
| Token 消耗 | 自定义计数器 | 日消耗 > 100k |
| 同步失败率 | 错误日志 | > 1% |

### 6.2 日志规范
```typescript
// 结构化日志
logger.info('Document synced', {
  documentId,
  userId,
  updateSize: bytes,
  latency: ms,
})
```

---

## 7. 开发阶段规划

### Phase 1: 离线编辑器 (Week 1)
- [ ] Turborepo 脚手架
- [ ] Tiptap 基础编辑器
- [ ] Yjs + IndexedDB 离线存储
- [ ] 基础 UI (Tailwind)

### Phase 2: 多人协同 (Week 2)
- [ ] Hocuspocus Server 搭建
- [ ] WebSocket 连接 + JWT 鉴权
- [ ] 协作光标 (Awareness)
- [ ] Postgres 持久化

### Phase 3: AI 对话 (Week 3)
- [ ] `/api/chat` 路由
- [ ] ChatSidebar 组件
- [ ] 流式输出 UI
- [ ] 停止生成功能

### Phase 4: AI 写作 (Week 4)
- [ ] `/api/completion` 路由
- [ ] StreamingNode 扩展
- [ ] BubbleMenu + AI 指令
- [ ] Slash Command (`/ai`)

### Phase 5: RAG (Week 5)
- [ ] BullMQ 队列搭建
- [ ] Embedding Worker
- [ ] pgvector 检索
- [ ] 上下文增强对话

### Phase 6: 生产化 (Week 6)
- [ ] Docker 镜像构建
- [ ] 环境变量管理
- [ ] 监控接入
- [ ] 错误处理优化

---

## 附录

### A. 依赖版本锁定
```json
{
  "next": "^14.0.0",
  "@tiptap/react": "^2.1.0",
  "yjs": "^13.6.0",
  "@hocuspocus/server": "^2.0.0",
  "@hocuspocus/provider": "^2.0.0",
  "ai": "^3.0.0",
  "@ai-sdk/openai": "^0.0.10",
  "drizzle-orm": "^0.29.0",
  "@nestjs/core": "^10.0.0",
  "bullmq": "^5.0.0"
}
```

### B. 参考资源
- [Tiptap 文档](https://tiptap.dev)
- [Yjs 文档](https://docs.yjs.dev)
- [Hocuspocus 文档](https://tiptap.dev/hocuspocus)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Drizzle ORM](https://orm.drizzle.team)
- [pgvector](https://github.com/pgvector/pgvector)

# NexusNote 2026 Architecture

更新时间：2026-04-01

## 总览

NexusNote 当前是一个以 Next.js 16 为核心的 AI-native 学习应用：

- App Router + React 19 + Cache Components
- Drizzle + PostgreSQL + pgvector
- Redis + BullMQ 处理后台任务
- AI SDK v6 驱动 chat、interview、course generation、RAG
- Tiptap + Yjs + PartyKit 提供协作编辑基础能力

目标不是“拼很多技术”，而是保持一条清晰主链：

`课程生成 -> 学习行为 -> evidence event -> knowledge evidence -> insight -> 成长树 / 知识工作台`

## 分层

### 1. Web Runtime

- `app/`: 页面、route handlers、动态边界
- `components/`: 交互组件和展示组件
- `hooks/`, `stores/`: 客户端状态和页面交互

规则：

- 页面默认 Server Component
- 请求期读取必须建立局部动态边界
- 不允许根布局用空白 `Suspense` 掩盖阻塞路由问题

更多见：

- [NEXT16_PAGE_BOUNDARY_RULES.md](/Users/findbiao/projects/nexusnote/docs/NEXT16_PAGE_BOUNDARY_RULES.md)

### 2. Server Domain Layer

- `lib/server/`: 页面数据加载和 cache/tag 策略
- `lib/chat/`, `lib/learning/`, `lib/notes/`, `lib/knowledge/`, `lib/career-tree/`
- `lib/api/`: API 错误和响应收口

规则：

- 页面数据获取尽量集中到 server loaders
- 默认动态，局部 `use cache` + `cacheTag` 驱动重验证
- 不把 request-bound 逻辑散落到组件树深处

### 3. AI Layer

- `lib/ai/core/`: provider、model policy、telemetry、degradation、resumable streams
- `lib/ai/agents/`: open-ended conversational agents
- `lib/ai/tools/`: capability tools
- `lib/ai/workflows/`: 固定顺序后台任务
- `lib/ai/prompts/`: prompt builders 和资源加载

规则：

- 单 provider 运行时
- `ToolLoopAgent` 用于开放式对话
- tools 只承载真正能力调用或副作用
- 结构化 UI 数据优先走 `UIMessage.parts`

### 4. Retrieval Layer

- `lib/rag/`: rewrite、hybrid search、chunking、trace
- `knowledge_chunks` 表承载统一检索索引
- 向量、全文、最近数据索引与查询路径严格对齐

更多见：

- [RAG_PERFORMANCE_AND_OBSERVABILITY.md](/Users/findbiao/projects/nexusnote/docs/RAG_PERFORMANCE_AND_OBSERVABILITY.md)

### 5. Data Layer

- `db/schema/`: 按领域拆分的 Drizzle schema
- `db/schema.ts`: 聚合导出和 relations
- `drizzle/`: 版本化迁移

当前 schema 已按以下领域拆分：

- auth
- notes
- conversations
- knowledge
- courses
- career-tree
- ai-usage
- skins

### 6. Async / Collaboration

- `lib/queue/`: BullMQ queue 和 worker
- `party/`: PartyKit realtime server
- 协作能力是可选运行时，不阻塞主应用主链

## 当前仓库约束

- 包管理器只用 `bun`
- 文档入口以 [docs/README.md](/Users/findbiao/projects/nexusnote/docs/README.md) 为准
- 代理开发规范以 [AGENTS.md](/Users/findbiao/projects/nexusnote/AGENTS.md) 为准
- 历史设计稿和实验资料统一放在 `docs/archive/`

## 非目标

当前仓库不再把这些内容当主架构的一部分：

- 多 provider 隐式自动切换
- Helm / ArgoCD / Flux 仓库内编排
- 根级别大而全代理说明
- 历史设计稿和一次性资料混在主 docs 入口

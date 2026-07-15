# NexusNote 2026 Architecture

更新时间：2026-04-01

## 总览

NexusNote 当前是一个以 Next.js 16 为核心的 AI-native 学习应用：

- App Router + React 19 + Cache Components
- Drizzle + PostgreSQL + pgvector
- Redis + BullMQ 处理后台任务
- AI SDK v6 驱动 chat、interview、course generation、RAG
- Tiptap 3 提供单用户结构化编辑能力

目标不是“拼很多技术”，而是保持一条清晰主链：

`课程生成 -> 学习行为 -> evidence event -> knowledge evidence -> insight -> 成长树 / 知识工作台`

`learning_activity_events` 同时是产品激活投影的事实源。生成、开学、首次完成、7 日继续和
课程完成由服务端重建；PostHog 只允许通过 transactional outbox 异步镜像。

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
- mutation 只调用 `lib/cache/domain-events.ts` 的领域失效入口，不在 route handler 里拼 tag 列表
- 不把 request-bound 逻辑散落到组件树深处

更多见：

- [CACHE_AND_ASYNC_CONTRACT.md](/Users/findbiao/projects/nexusnote/docs/CACHE_AND_ASYNC_CONTRACT.md)

### 3. AI Layer

- `lib/ai/core/`: model gateway、model policy、telemetry、degradation、resumable streams
- `lib/ai/agents/`: open-ended conversational agents
- `lib/ai/tools/`: capability tools
- `lib/ai/workflows/`: 固定顺序后台任务
- `lib/ai/prompts/`: prompt builders 和资源加载

规则：

- 用户选择模型系列，运行时网关不作为产品概念暴露
- `ToolLoopAgent` 用于开放式对话
- tools 只承载真正能力调用或副作用
- 结构化 UI 数据优先走 `UIMessage.parts`

### 4. Retrieval Layer

- `lib/rag/`: rewrite、hybrid search、chunking、trace
- `knowledge_evidence_chunks` 表承载统一检索索引
- Qwen3 Embedding 统一输出 1536 维 MRL 向量
- pgvector `vector(1536)` + cosine HNSW 承载近似最近邻检索
- 向量、全文、最近数据索引与查询路径严格对齐

更多见：

- [RAG_PERFORMANCE_AND_OBSERVABILITY.md](/Users/findbiao/projects/nexusnote/docs/RAG_PERFORMANCE_AND_OBSERVABILITY.md)

### 5. Data Layer

- `db/schema/`: 按领域拆分的 Drizzle schema
- `db/schema.ts`: 聚合导出和 relations
- `drizzle.config.mjs`: Drizzle authoring config，供本地 `db:push` 和平台侧 schema 检查使用

当前 schema 已按以下领域拆分：

- auth
- notes
- conversations
- knowledge
- knowledge-runs
- courses
- career-tree
- ai-usage
- skins
- learning

职业树当前使用 completion-based progression：`mastery_score` 是兼容字段，数值必须与阅读
进度一致；内部 `mastered` 状态只表示关联学习内容 100% 完成，用户界面统一展示“已完成”。

学习状态由 `learning_enrollments` 和 `learning_section_completions` 统一承载。私有课程绑定
`course_outline_versions`，公开课程绑定 `course_publication_snapshots`；章节完成、继续位置和
百分比均为可重建投影。课程 revision、section document、批注和完成记录不可变绑定，不允许
改版时覆盖旧学习资产。

### 6. Async Runtime

- `lib/queue/`: BullMQ queue 和 worker
- `scripts/start-workers.ts` + `scripts/start-*-worker.ts`: 显式 worker runtime 入口

规则：

- Web runtime 不隐式启动 BullMQ worker
- 后台任务由独立 worker 进程 / service 承载
- worker 生命周期、并发和重试参数必须显式配置，而不是挂在页面服务器副作用里
- `after()` 只放响应后的轻量 follow-up；可重试、长耗时、有副作用链路的任务进入 BullMQ
- 关键领域事务通过 PostgreSQL transactional outbox 与 BullMQ 衔接，worker 心跳属于 readiness
- outbox 使用 pending / retrying / processed / dead-letter 状态机；关键死信和超龄积压属于
  系统健康失败，可选产品分析镜像失败不阻断产品健康

### 7. Product and Operations Control Plane

- `lib/learning/activation.ts`: 用户激活阶段与运营 cohort 漏斗
- `lib/ai/core/free-chat-governor.ts`: 基础聊天软成本路由，不承担 entitlement
- `lib/operations/`: outbox SLO、死信重放和运维投影
- `lib/observability/trace.ts`: 结构化 JSON trace，RAG 子链共享 traceId

## 当前仓库约束

- 包管理器只用 `bun`
- 文档入口以 [docs/README.md](/Users/findbiao/projects/nexusnote/docs/README.md) 为准
- 代理开发规范以 [AGENTS.md](/Users/findbiao/projects/nexusnote/AGENTS.md) 为准
- 不在仓库内保留历史方案、一次性计划和过渡文档

## 非目标

当前仓库不再把这些内容当主架构的一部分：

- 多上游隐式自动切换
- Helm / ArgoCD / Flux 仓库内编排
- 根级别大而全代理说明
- 历史方案和过渡文档回流到仓库
- 未完成鉴权、租户隔离和持久化契约的实时协作运行时

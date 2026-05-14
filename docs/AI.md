# NexusNote AI System

更新时间：2026-04-30

## 核心原则

- 单一运行时 provider：当前运行时统一走 302.ai，不做隐式多 provider fallback
- 用户可选 AI 链路：前台聊天、访谈、课程蓝图、章节生成按用户偏好选择平台推荐 / 国产 / Gemini / OpenAI 链路
- AI SDK v6 原生：以 `useChat`、route handlers、`UIMessage.parts`、agents、workflows 为主
- code-driven：流程由代码控制，prompt 负责表达，不负责弥补架构缺陷
- degradation-first：模型、结构化输出、embedding 出问题时显式降级，不静默伪装成功
- tool 隔离：工具是能力调用，不是所有 UI 数据都必须通过 tool 返回

## 当前架构

### Provider 层

- 文件：
  - [provider.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/provider.ts)
  - [model-policy.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/model-policy.ts)
  - [route-profiles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/route-profiles.ts)
  - [model-bundles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/model-bundles.ts)
  - [degradation.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/degradation.ts)

职责：

- 统一 302.ai client 初始化
- 提供 chat / outline / sectionDraft / extract / review / webSearch / embedding 模型入口
- 通过 model policy 隔离业务意图和具体模型 ID
- 通过 route profile 隔离用户偏好和具体模型组合
- 把不可用状态分类为可处理的降级结果

### Route Profile 层

用户设置里的 AI 链路只影响前台学习体验：

- `/api/chat`
- `/api/interview`
- 课程蓝图生成所在的自然访谈 agent
- 章节内容生成 worker

不受用户链路影响的后台基础设施：

- embedding / reranker
- RAG 索引
- career-tree evidence / merge / compose
- 标签、风格分析、质量评审等后台任务

这条边界避免“用户想试 Gemini”时把索引、职业树和长期知识图一起改掉。

### Prompt 层

- 静态 prompt 资源统一放在 [lib/ai/prompts/resources](/Users/findbiao/projects/nexusnote/lib/ai/prompts/resources)
- 加载器在 [load-prompt.ts](/Users/findbiao/projects/nexusnote/lib/ai/prompts/load-prompt.ts)
- 动态上下文拼装继续留在代码里，例如 interview、learn prompt builder

规则：

- 静态系统提示词外置
- 动态业务上下文、用户上下文、结构化状态在代码中拼装
- 不把 prompt 文件当运行时状态机

### Agent / Workflow 层

- 对话型场景：`ToolLoopAgent`
- 固定顺序后台任务：workflow
- 结构化 UI 数据：优先 `UIMessage` 的 `data-*` parts
- 真正能力执行或副作用：tool

当前典型场景：

- 访谈：自然 agent + 展示类 tool + 课程蓝图数据
- 学习助手：chat + learn context + RAG
- 课程生成：workflow + 服务端流式生成
- research / career-tree / knowledge-insights / RAG indexing / section materialization：显式 worker runtime 执行，不挂在 web 进程副作用里

### Streaming 层

- 路由处理器负责真实流式输出
- 中文输出使用 `smoothStream()` + `Intl.Segmenter`
- 长连接恢复使用 resumable streams
- 前端只消费允许展示的 parts，不做“假流式补 UI”

## RAG 约束

- 查询链路：rewrite → vector search → keyword search → RRF fusion
- trace 入口统一走 [observability.ts](/Users/findbiao/projects/nexusnote/lib/rag/observability.ts)
- 禁止在检索查询里使用 `sql.raw()` 拼接过滤条件
- embedding、全文索引、最近数据索引必须和查询路径对应

更多见：

- [RAG_PERFORMANCE_AND_OBSERVABILITY.md](/Users/findbiao/projects/nexusnote/docs/RAG_PERFORMANCE_AND_OBSERVABILITY.md)

## 观测与回归

### 运行时观测

- 通用 trace 基础设施在 [trace.ts](/Users/findbiao/projects/nexusnote/lib/observability/trace.ts)
- learn 关键链路 trace 在 [observability.ts](/Users/findbiao/projects/nexusnote/lib/learning/observability.ts)
- 开关：
  - `APP_TRACE_LOGS=true`：统一打开应用级关键链路 trace
  - `LEARN_DEBUG_LOGS=true`：只打开 learn trace
  - `RAG_DEBUG_LOGS=true`：只打开 RAG trace

当前已覆盖：

- `/api/learn/generate`
- `/api/learn/chat-session`
- `getLearnPageSnapshotCached`
- `resolveOwnedLearnContext`
- `runGenerateCourseSectionWorkflow`

### 回归用例

- AI eval runner 除了 AI judge，还执行 case 自带的确定性 regression checks
- 当前覆盖：
  - `chat`：非空、关键术语、禁止 tool/UI artifact 泄漏
  - `learn`：章节对齐、关键术语、禁止明显跑题
  - `notes`：保留原始事实、禁止编造负责人/截止时间

运行方式：

- `bun run ai:eval`
- `bun run ai:eval chat`
- `bun run ai:eval learn`
- `bun run ai:eval notes`

## 前端契约

- 前端不伪造 AI 结构化结果
- tool 展示和普通 assistant 文本必须隔离
- 对话 UI 只渲染服务端允许呈现的 parts
- UI fallback 只能处理加载和错误，不能伪造业务结果

## 当前重点文档

- [AI_ROLE_SYSTEM_2026.md](/Users/findbiao/projects/nexusnote/docs/AI_ROLE_SYSTEM_2026.md)
- [AI_SDK_V6_PROJECT_GUIDELINES.md](/Users/findbiao/projects/nexusnote/docs/AI_SDK_V6_PROJECT_GUIDELINES.md)
- [ai-sdk-v6-guide.md](/Users/findbiao/projects/nexusnote/docs/ai-sdk-v6-guide.md)
- [ai-sdk-v6-advanced-features.md](/Users/findbiao/projects/nexusnote/docs/ai-sdk-v6-advanced-features.md)
- [NEXT16_PAGE_BOUNDARY_RULES.md](/Users/findbiao/projects/nexusnote/docs/NEXT16_PAGE_BOUNDARY_RULES.md)
- [RAG_PERFORMANCE_AND_OBSERVABILITY.md](/Users/findbiao/projects/nexusnote/docs/RAG_PERFORMANCE_AND_OBSERVABILITY.md)

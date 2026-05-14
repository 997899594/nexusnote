# 2026-05-14 AI Runtime 迁移计划

## 范围

这份计划服务于一个目标：

> 把 NexusNote 当前“profile 驱动的对话运行时”升级成“Context Resolver + Intent Router + Specialists + Workflow Core”的统一 runtime。

这不是一次功能 patch，而是一次运行时抽象升级。

## 当前状态

当前仓库已经有这些可复用基础：

- provider / model policy / route profile / telemetry / degradation 主链齐全，[docs/AI.md](/Users/findbiao/projects/nexusnote/docs/AI.md#L14)
- chat 与 interview 已经是 `ToolLoopAgent` 模式，[app/api/chat/route.ts](/Users/findbiao/projects/nexusnote/app/api/chat/route.ts) 与 [app/api/interview/route.ts](/Users/findbiao/projects/nexusnote/app/api/interview/route.ts)
- learn 已经有 learning guidance、`loadLearnContext`、RAG 组合，[lib/ai/tools/index.ts](/Users/findbiao/projects/nexusnote/lib/ai/tools/index.ts#L26)
- growth / career tree 已经是 deterministic snapshot + projection 体系，[docs/plans/2026-04-17-doc-alignment-audit.md](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-17-doc-alignment-audit.md#L49)

当前缺口：

- [lib/ai/context/resolve-chat-context.ts](/Users/findbiao/projects/nexusnote/lib/ai/context/resolve-chat-context.ts#L6) 只区分 `CHAT_BASIC` 和 `LEARN_ASSIST`
- [lib/ai/core/capability-profiles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/capability-profiles.ts#L4) 仍是窄抽象
- [app/api/chat/route.ts](/Users/findbiao/projects/nexusnote/app/api/chat/route.ts#L77) 还没有正式 route decision
- [tests/ai-evals/chat/cases.ts](/Users/findbiao/projects/nexusnote/tests/ai-evals/chat/cases.ts#L3) 只有 chat prompt 质量回归，没有 routing domain

## 总体原则

### 1. 先换抽象，再扩能力

先建立统一 runtime contract，再引入新的 specialist。  
不要先堆 `research`、`career guide`，再反过来收抽象。

### 2. router 负责决策，specialist 负责执行

router 输出的是结构化 route decision。  
specialist 只消费 route decision，不自行替代 router。

### 3. workflow 和 truth core 不回退

以下链路不是这次路由重构的目标：

- growth extract / merge / compose
- create course
- section generation
- snapshot projection
- persistence / idempotency

### 4. 直接切换，不保留兼容层

这次迁移不采用长期双轨：

- 不保留新 contract 到旧 `AgentProfile` 的桥接层
- 不保留 `resolveRequestContext()` 与 `resolveChatContext()` 并存
- 不保留 `ChatMetadata` 与 `RequestMetadata` 双命名
- 不保留旧 specialist 概念作为公开运行时抽象

允许的回退方式只有代码层回滚，不是运行时兼容。

## 目标目录

### 新增

- [lib/ai/runtime/contracts.ts](/Users/findbiao/projects/nexusnote/lib/ai/runtime/contracts.ts)
- [lib/ai/runtime/resolve-request-context.ts](/Users/findbiao/projects/nexusnote/lib/ai/runtime/resolve-request-context.ts)
- [lib/ai/runtime/orchestrate-request.ts](/Users/findbiao/projects/nexusnote/lib/ai/runtime/orchestrate-request.ts)
- [lib/ai/routing/schemas.ts](/Users/findbiao/projects/nexusnote/lib/ai/routing/schemas.ts)
- [lib/ai/routing/classify-intent.ts](/Users/findbiao/projects/nexusnote/lib/ai/routing/classify-intent.ts)
- [lib/ai/routing/route-arbiter.ts](/Users/findbiao/projects/nexusnote/lib/ai/routing/route-arbiter.ts)
- [lib/ai/specialists/registry.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/registry.ts)
- [lib/ai/specialists/general.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/general.ts)
- [lib/ai/specialists/learn.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/learn.ts)
- [lib/ai/specialists/notes.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/notes.ts)
- [lib/ai/specialists/research.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/research.ts)
- [lib/ai/specialists/career.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/career.ts)
- [lib/ai/specialists/interview.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/interview.ts)
- [lib/ai/tools/career/context.ts](/Users/findbiao/projects/nexusnote/lib/ai/tools/career/context.ts)
- [tests/ai-evals/routing/cases.ts](/Users/findbiao/projects/nexusnote/tests/ai-evals/routing/cases.ts)

### 将被重构

- [app/api/chat/route.ts](/Users/findbiao/projects/nexusnote/app/api/chat/route.ts)
- [lib/ai/agents/chat.ts](/Users/findbiao/projects/nexusnote/lib/ai/agents/chat.ts)
- [lib/ai/core/capability-profiles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/capability-profiles.ts)
- [lib/ai/core/prompt-registry.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/prompt-registry.ts)
- [lib/ai/tools/index.ts](/Users/findbiao/projects/nexusnote/lib/ai/tools/index.ts)
- [types/metadata.ts](/Users/findbiao/projects/nexusnote/types/metadata.ts)
- [tests/ai-evals/chat/cases.ts](/Users/findbiao/projects/nexusnote/tests/ai-evals/chat/cases.ts)
- [scripts/run-ai-evals.ts](/Users/findbiao/projects/nexusnote/scripts/run-ai-evals.ts)

### 将被删除或降级

- [lib/ai/context/resolve-chat-context.ts](/Users/findbiao/projects/nexusnote/lib/ai/context/resolve-chat-context.ts)
- [lib/ai/core/capability-profiles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/capability-profiles.ts)
- 旧 `CHAT_BASIC / LEARN_ASSIST / NOTE_ASSIST` 命名
- `ChatMetadata` 命名

## Phase 0：文档与命名冻结

目标：先冻结概念，避免边写代码边改世界观。

工作：

- 合并本 ADR 与本计划
- 确认终局命名：
  - `Surface`
  - `CapabilityMode`
  - `ExecutionMode`
  - `DataScope`
  - `RequestContext`
  - `RouteDecision`

验收：

- 文档通过评审
- 后续实现不得再引入新的平行命名层

回滚：

- 无代码回滚，仅文档修订

## Phase 1：引入统一 runtime contract

目标：直接用新的 runtime contract 替换旧入口。

工作：

- 新增 [lib/ai/runtime/contracts.ts](/Users/findbiao/projects/nexusnote/lib/ai/runtime/contracts.ts)
- 把 [types/metadata.ts](/Users/findbiao/projects/nexusnote/types/metadata.ts) 直接改成 `RequestMetadata`
- 新增 [lib/ai/runtime/resolve-request-context.ts](/Users/findbiao/projects/nexusnote/lib/ai/runtime/resolve-request-context.ts)
- 让 `resolveRequestContext()` 输出：
  - surface
  - metadata
  - course / editor / session 资源
  - hasLearningGuidance
  - hasGrowthSnapshot
  - routeProfile
- 同一阶段删除 [lib/ai/context/resolve-chat-context.ts](/Users/findbiao/projects/nexusnote/lib/ai/context/resolve-chat-context.ts)

设计要求：

- 这一阶段不引入新 specialist
- `/api/chat` 必须直接读 `RequestContext`
- 新 runtime contract 不得再暴露 `AgentProfile`
- 旧执行层仅可作为当前实现留存到 specialist phase，被一次性替换，不新增桥接层

验收：

- `/api/chat` 已改为读取新的 `RequestContext`
- 当前 chat / learn 行为不回归
- `bun run typecheck`
- `bun run ai:eval chat`
- `bun run ai:eval learn`

回滚：

- 通过 git 回滚整组改动，不保留旧入口并存

## Phase 2：引入 structured intent classifier

目标：让 router 先变成正式结构，并替换旧 profile 分流。

工作：

- 新增 [lib/ai/routing/schemas.ts](/Users/findbiao/projects/nexusnote/lib/ai/routing/schemas.ts)
- 新增 [lib/ai/routing/classify-intent.ts](/Users/findbiao/projects/nexusnote/lib/ai/routing/classify-intent.ts)
- 分类器输入：
  - latest user message
  - recent conversation summary
  - request context
  - allowed capability contracts
- 分类器输出：
  - intent
  - capabilityMode
  - executionMode
  - requiredScopes
  - confidence
  - reasons

设计要求：

- 不允许正则硬匹配代替主分类器
- 不允许分类器直接返回自由文本
- 分类器必须用 schema 严格校验

验收：

- 能独立跑 `classifyIntent()`
- 有基础 routing fixtures
- 失败时可优雅回落到 `general_chat`

回滚：

- classifier 失败时，回退到基于 surface 的默认路由

## Phase 3：加入 route arbiter

目标：让代码掌握最终路由边界。

工作：

- 新增 [lib/ai/routing/route-arbiter.ts](/Users/findbiao/projects/nexusnote/lib/ai/routing/route-arbiter.ts)
- 把这些硬约束落进去：
  - no course context -> 禁止 `learn_coach`
  - no growth snapshot -> 禁止直接 `career_guide`
  - write / create / long-running -> 强制 `workflow` 或 `redirect`
  - interview surface -> 默认 `course_interviewer`

设计要求：

- classifier 和 arbiter 结果都进入 telemetry
- arbiter 有权覆盖 classifier

验收：

- route decision 在日志和 telemetry 中可见
- `bun run ai:eval routing`
- 至少有 3 个“分类器想选 A，但仲裁改成 B”的 case

回滚：

- 通过 git 回滚到 classifier 引入前版本，不保留长期 `classifierOnly` 双轨

## Phase 4：specialist 拆分

目标：不再由一个 chat 工厂承载全部对话能力。

工作：

- 把 [lib/ai/agents/chat.ts](/Users/findbiao/projects/nexusnote/lib/ai/agents/chat.ts) 拆到 [lib/ai/specialists/](/Users/findbiao/projects/nexusnote/lib/ai/specialists)
- 同一阶段删除 [lib/ai/core/capability-profiles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/capability-profiles.ts)
- 正式建立 6 个 specialist：
  - `general_chat`
  - `learn_coach`
  - `note_assistant`
  - `research_assistant`
  - `career_guide`
  - `course_interviewer`
- 新建 [lib/ai/specialists/registry.ts](/Users/findbiao/projects/nexusnote/lib/ai/specialists/registry.ts)

工具策略：

- `general_chat`
  - 默认轻工具，必要时 web search
- `learn_coach`
  - `loadLearnContext + hybridSearch + webSearch`
- `note_assistant`
  - `searchNotes + note CRUD + enhance`
- `research_assistant`
  - `webSearch + hybridSearch + searchNotes`
- `career_guide`
  - `loadCareerContext + hybridSearch + searchNotes`
- `course_interviewer`
  - 维持现有 interview tool loop + workflow handoff

验收：

- specialist 都能被 registry 独立创建
- 当前 chat/learn/interview 不回归
- 新 specialist 的 prompt / tool set 都有单独定义

回滚：

- 通过 git 回滚整组 specialist 改动，不保留旧 chat 工厂映射

## Phase 5：shared data plane 收口

目标：把 `growth / RAG / notes / web` 从隐式上下文变成正式可读能力层。

工作：

- 新增 [lib/ai/tools/career/context.ts](/Users/findbiao/projects/nexusnote/lib/ai/tools/career/context.ts)
- 只读暴露：
  - growth snapshot
  - current direction
  - focus
  - insights
  - candidate trees
- route-aware 处理 growth context 注入：
  - `career_guide` 读详细 snapshot
  - `learn_coach` 只读 guidance 所需 growth 摘要
  - `general_chat` 不再默认携带完整 growth context

设计要求：

- data plane 是共享基础设施，不是单独 specialist
- growth truth 不允许被 specialist 直接写入

验收：

- `career_guide` 能解释当前树、方向差异、下一步建议
- growth runtime 不受聊天路由影响

回滚：

- 通过 git 回滚 `career_guide` 读路径改动，不保留运行时兼容分支

## Phase 6：workflow plane 对齐

目标：让 execution mode 真正驱动路由。

工作：

- 把 `/interview`、create-course、section generation、growth runtime 都在 runtime 里标注为 `executionMode = workflow` 或 `redirect`
- chat specialist 不再直接包办创建课程、长任务、强副作用链路
- [app/api/interview/create-course/route.ts](/Users/findbiao/projects/nexusnote/app/api/interview/create-course/route.ts) 保持独立 workflow 入口

验收：

- specialist 层不直接触发重副作用写路径
- workflow 入口边界在代码里能被定位

回滚：

- 通过 git 回滚 workflow plane 标注改动，不保留双入口语义

## Phase 7：eval 与 telemetry 升级

目标：让路由变成可评测系统，而不是主观感觉。

工作：

- 新增 [tests/ai-evals/routing/cases.ts](/Users/findbiao/projects/nexusnote/tests/ai-evals/routing/cases.ts)
- [scripts/run-ai-evals.ts](/Users/findbiao/projects/nexusnote/scripts/run-ai-evals.ts) 增加 `routing` domain
- telemetry 增加：
  - `surface`
  - `intent`
  - `capabilityMode`
  - `executionMode`
  - `requiredScopes`
  - `routeConfidence`
  - `routeReasons`

评测至少覆盖：

- learn vs career 容易混淆的问题
- note transform vs general chat
- research vs direct answer
- classifier 与 arbiter 的冲突 case
- clarification / abstain case

验收：

- `bun run ai:eval routing`
- `bun run ai:eval chat`
- `bun run ai:eval learn`
- `bun run ai:eval notes`

回滚：

- telemetry 字段允许增量接入观测面板，但不影响 runtime 主链切换

## 删除策略

这次迁移不设置“以后再删”的长期旧路径。

删除原则：

- `resolveRequestContext()` 上线的同一阶段删除 `resolveChatContext()`
- specialist registry 上线的同一阶段删除 `capability-profiles.ts`
- `RequestMetadata` 上线的同一阶段删除 `ChatMetadata` 命名

如果阶段内做不到同批删除，视为该阶段未完成，而不是把旧路径继续保留到下一阶段。

## 风险

### 风险 1：router 过早过重

缓解：

- classifier 先用小模型
- arbiter 保持简单硬边界
- 不在第一阶段加入太多 specialist

### 风险 2：learn 与 career 边界相互污染

缓解：

- `learn_coach` 继续优先课程上下文
- `career_guide` 读取 snapshot，不直接替代课程解释

### 风险 3：workflow 被重新塞回对话热路径

缓解：

- execution mode 成为正式契约
- code review 明确阻止这类回退

## 命令基线

每个阶段至少保持这些命令通过：

- `bun run lint`
- `bun run typecheck`
- `bun run ai:eval chat`
- `bun run ai:eval learn`
- `bun run ai:eval notes`

阶段 7 起新增：

- `bun run ai:eval routing`

涉及主要运行链路变更时，再补：

- `SKIP_ENV_VALIDATION=true bun run build`

## 最终验收

当以下条件同时成立时，这次迁移可以视为完成：

- `/api/chat` 通过统一 runtime 编排
- route decision 是正式结构化产物
- specialist 数量稳定在 6 个左右，而不是继续按学科膨胀
- growth / create-course / section generation 仍在 workflow plane
- RAG / notes / growth / web 成为正式 data plane
- routing eval、specialist eval、现有 chat/learn/notes eval 都稳定通过

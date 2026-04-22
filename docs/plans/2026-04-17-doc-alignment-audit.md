# 2026-04-17 文档对齐审计

## 范围

本审计只回答一个问题：

> 当前代码是否已经符合 [docs/plans/2026-04-14-nexusnote-蓝图.md](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-蓝图.md)、[docs/plans/2026-04-14-nexusnote-task-实现计划.md](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-task-实现计划.md)、[docs/plans/2026-04-16-growth-compose-modernization.md](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-16-growth-compose-modernization.md)。

这里主要审计“代码与运行链路是否符合文档”。远端环境的最终切换记录不在这份审计里混写，但当前仓库对应的本地目标库迁移执行已经纳入验证范围。

## 结论

结论分两层：

1. 只看代码结构、AI 评测、本地 build 基线、以及真实数据库上的运行链路验证：
当前实现已经高度对齐文档主链路。Phase 1-4 的关键 runtime 路径都能在代码里找到落点，不再是旧 golden-path 常量驱动，也不再存在 `backfill / verify / cutover` 各自维护一套逻辑的情况。

2. 如果把“100%”定义成：
文档中的终态代码 + 当前目标库 schema apply + 全量 backfill + 全量 verify 全部执行完成，
那这次我可以写“当前仓库与当前目标库范围内已经完成”。

更准确的表述是：

> 以当前仓库代码和当前本地目标库为范围，这套实现已经对齐文档；当前没有再发现明显违背设计的旧路径。

## 命令验证

本次重新跑过并通过：

- `bun run lint`
- `bun run typecheck`
- `SKIP_ENV_VALIDATION=true bun run build`
- `bun run growth:check`
- `bun run ai:eval growth`
- `bun run growth:verify -- --limit 1`
- `bun run growth:cutover -- --skip-apply --limit 1`
- `bun run growth:cutover`

说明：

- `typecheck` 与 `build` 并行跑时会争用 `.next/types/cache-life.d.ts`，串行执行正常。这是执行顺序注意事项，不是当前文档主链路设计偏差。
- `growth:verify` 与 `growth:cutover -- --skip-apply` 已在真实本地数据上跑通，证明 runtime maintenance 已经不是纸面重构，而是可执行闭环。
- `growth:cutover` 已对当前目标库真实执行 tracked Drizzle migrations + full backfill + full verify，并且跑通。

## 对照结果

### 已满足：Phase 1 职业树闭环

文档验收标准见 [docs/plans/2026-04-14-nexusnote-task-实现计划.md:119](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-task-实现计划.md#L119)。

- `GET /api/user/career-trees` 只读 snapshot，`pending` 时只做幂等 enqueue，不同步生成，见 [app/api/user/career-trees/route.ts:13](/Users/findbiao/projects/nexusnote/app/api/user/career-trees/route.ts#L13)。
- `PUT /api/user/career-trees` 返回 `202`，只写偏好、写 preference event、触发 compose，见 [app/api/user/career-trees/route.ts:21](/Users/findbiao/projects/nexusnote/app/api/user/career-trees/route.ts#L21)。
- growth compose 仍然是 `snapshot -> projection`，并且已经按 modernization 文档拆成 planner/layout/metadata 三段式，验证命令 `growth:check` 与 `ai:eval growth` 已通过。
- `user_career_tree_snapshots`、`user_focus_snapshots`、`user_profile_snapshots`、`user_growth_state` 等终态表已经进入 schema authoring，见 [db/schema/growth.ts](/Users/findbiao/projects/nexusnote/db/schema/growth.ts)。

### 已满足：Phase 2 统一 Evidence 层

文档验收标准见 [docs/plans/2026-04-14-nexusnote-task-实现计划.md:214](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-task-实现计划.md#L214)。

- 新知识来源统一先进入 event，再聚合成 evidence，再触发 growth/insight，见 [lib/knowledge/source-sync.ts:50](/Users/findbiao/projects/nexusnote/lib/knowledge/source-sync.ts#L50)。
- event 写入口已经统一，见 [lib/knowledge/events/ingest.ts:12](/Users/findbiao/projects/nexusnote/lib/knowledge/events/ingest.ts#L12)。
- event 聚合为 evidence 的主逻辑已落地，见 [lib/knowledge/evidence/aggregate.ts](/Users/findbiao/projects/nexusnote/lib/knowledge/evidence/aggregate.ts)。
- 课程外来源已经进入统一知识链：
  - 笔记写入与知识同步见 [lib/notes/write-service.ts:150](/Users/findbiao/projects/nexusnote/lib/notes/write-service.ts#L150)
  - 对话 capture 见 [app/api/notes/capture-chat/route.ts](/Users/findbiao/projects/nexusnote/app/api/notes/capture-chat/route.ts)
  - learn annotation / progress 见 [app/api/learn/annotations/route.ts](/Users/findbiao/projects/nexusnote/app/api/learn/annotations/route.ts) 与 [app/api/learn/progress/route.ts:156](/Users/findbiao/projects/nexusnote/app/api/learn/progress/route.ts#L156)
  - 通用对话同步见 [lib/chat/conversation-knowledge.ts:80](/Users/findbiao/projects/nexusnote/lib/chat/conversation-knowledge.ts#L80)

### 已满足：Phase 3 Insight 层

文档验收标准见 [docs/plans/2026-04-14-nexusnote-task-实现计划.md:274](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-task-实现计划.md#L274)。

- `knowledge_insights` / `knowledge_insight_evidence` 已进入 schema，见 [db/schema/knowledge.ts:126](/Users/findbiao/projects/nexusnote/db/schema/knowledge.ts#L126)。
- insight 生成任务已存在并接入 growth worker，见 [lib/knowledge/insights/jobs.ts](/Users/findbiao/projects/nexusnote/lib/knowledge/insights/jobs.ts) 与 [lib/queue/growth-worker.ts](/Users/findbiao/projects/nexusnote/lib/queue/growth-worker.ts)。
- Profile 不再只展示计数，而是直接消费 growth workspace + insights，见 [lib/server/profile-insights-page-data.ts:96](/Users/findbiao/projects/nexusnote/lib/server/profile-insights-page-data.ts#L96) 与 [app/profile/insights/page.tsx](/Users/findbiao/projects/nexusnote/app/profile/insights/page.tsx)。
- Editor 已经能消费 focus + insight 做工作台排序，而不是只按笔记时间平铺，见 [lib/knowledge/workbench-projection.ts:251](/Users/findbiao/projects/nexusnote/lib/knowledge/workbench-projection.ts#L251)。
- 职业树解释理由已经稳定挂在 projection/snapshot 上，而不是页面临时拼文案，见 [lib/growth/projections.ts:258](/Users/findbiao/projects/nexusnote/lib/growth/projections.ts#L258)。

### 已满足：Phase 4 双向回流主链

文档验收标准见 [docs/plans/2026-04-14-nexusnote-task-实现计划.md:321](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-task-实现计划.md#L321)。

- 新 evidence 到来后会刷新 growth / focus / profile 投影，见 [lib/knowledge/source-sync.ts:24](/Users/findbiao/projects/nexusnote/lib/knowledge/source-sync.ts#L24)。
- 职业树 / 当前焦点已经影响学习建议：
  - learn guidance 读取 `getUserGrowthContext()`，见 [lib/learning/guidance.ts:111](/Users/findbiao/projects/nexusnote/lib/learning/guidance.ts#L111)
  - learn page snapshot 把 growth context 编进页面投影，见 [lib/server/learn-data.ts:62](/Users/findbiao/projects/nexusnote/lib/server/learn-data.ts#L62)
  - section 生成也消费同一份 guidance，见 [lib/ai/workflows/generate-course-section.ts:59](/Users/findbiao/projects/nexusnote/lib/ai/workflows/generate-course-section.ts#L59)
- 后续课程生成开始消费隐藏能力图 / growth context，见 [app/api/interview/create-course/route.ts:52](/Users/findbiao/projects/nexusnote/app/api/interview/create-course/route.ts#L52)。
- 页面开始读同一套底层知识流的不同投影：
  - 职业树工作区见 [lib/server/growth-workspace-data.ts:29](/Users/findbiao/projects/nexusnote/lib/server/growth-workspace-data.ts#L29)
  - Learn 页投影见 [lib/learning/projection.ts](/Users/findbiao/projects/nexusnote/lib/learning/projection.ts)
  - Profile 首页见 [lib/server/profile-home-data.ts](/Users/findbiao/projects/nexusnote/lib/server/profile-home-data.ts)
  - Profile Insights 页见 [lib/server/profile-insights-page-data.ts](/Users/findbiao/projects/nexusnote/lib/server/profile-insights-page-data.ts)
  - Editor 工作台见 [lib/knowledge/workbench-projection.ts](/Users/findbiao/projects/nexusnote/lib/knowledge/workbench-projection.ts)

### 已满足：蓝图成功标准的大部分代码含义

蓝图成功标准见 [docs/plans/2026-04-14-nexusnote-蓝图.md:372](/Users/findbiao/projects/nexusnote/docs/plans/2026-04-14-nexusnote-蓝图.md#L372)。

- “知识可跨课程、对话、笔记、职业树流动”：
  当前已经成立，关键证据是 event/evidence/source-sync/growth/projection 全链路。
- “成长分支多次再生成后仍连续”：
  当前有 `growth:check` 与 `ai:eval growth` 做静态/合成场景验证。
- “系统不只是记录学习，还会反过来重组学习”：
  当前已经通过 growth context 进入 course creation、learn guidance、section generation、editor ranking。

## 今天新增收口

今天额外做了一处架构清理：

- 把个人页摘要和职业树页里重复的 growth 展示推导收成一个共享 view-model，见 [lib/growth/view-model.ts:182](/Users/findbiao/projects/nexusnote/lib/growth/view-model.ts#L182)。
- 对应消费方改为共享这条路径：
  - [components/profile/ProfileCareerTreeSummary.tsx](/Users/findbiao/projects/nexusnote/components/profile/ProfileCareerTreeSummary.tsx)
  - [components/career-trees/CareerTreesExplorer.tsx](/Users/findbiao/projects/nexusnote/components/career-trees/CareerTreesExplorer.tsx)
- 把 growth 迁移期维护链路收成库级单一实现，见 [lib/growth/runtime-maintenance.ts](/Users/findbiao/projects/nexusnote/lib/growth/runtime-maintenance.ts)。
  现在：
  - [scripts/backfill-user-growth.ts](/Users/findbiao/projects/nexusnote/scripts/backfill-user-growth.ts)
  - [scripts/verify-growth-runtime.ts](/Users/findbiao/projects/nexusnote/scripts/verify-growth-runtime.ts)
  - [scripts/cutover-growth-runtime.ts](/Users/findbiao/projects/nexusnote/scripts/cutover-growth-runtime.ts)
  都只做 CLI 参数解析和日志，不再各自维护运行时逻辑，也不再脚本套脚本。
- 把数据库维护链路收成单一 Drizzle 路径：
  - [scripts/db-maintenance.mjs](/Users/findbiao/projects/nexusnote/scripts/db-maintenance.mjs)
  - [scripts/db-migrate.mjs](/Users/findbiao/projects/nexusnote/scripts/db-migrate.mjs)
  - [scripts/cutover-growth-runtime.ts](/Users/findbiao/projects/nexusnote/scripts/cutover-growth-runtime.ts)
  现在 cutover 与本地 `db:migrate` 共用同一套 Drizzle 迁移入口，不再维护 sidecar schema 或第二套 schema apply 路径。

这一步不是新功能，但它让“页面只是视图”这条蓝图原则更干净。

## 范围边界

这份结论现在可以说到“当前仓库 + 当前本地目标库”这一级别。

它不自动替代远端环境切换记录，但那已经不是“项目代码是否符合文档”的问题，而是环境执行问题。

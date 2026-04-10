# AI 多候选职业树 Phase 1 实施版

## Summary
- 直接替换当前 hardcoded `golden-path` 运行时架构；旧 ontology 和旧 mapping tables 不进入新链路。
- 真相只在**单个用户**范围内成立：`课程证据 -> 用户隐藏能力图 -> 多棵候选职业树快照`。
- 页面只读最新快照；**不在请求路径上跑 extraction / merge / compose**。
- AI 负责：课程抽取、同义能力合并方案、候选职业树组织与命名。
- 代码负责：Zod 校验、幂等、候选集裁剪、事务写入、聚合分数、状态计算、稳定 key、快照读取。

## Implementation Changes
### 1. 新数据层
- 新建表：
  - `career_generation_runs`
  - `career_course_skill_evidence`
  - `career_course_chapter_evidence`
  - `career_user_skill_nodes`
  - `career_user_skill_edges`
  - `career_user_skill_node_evidence`
  - `career_user_tree_preferences`
  - `career_user_tree_snapshots`
  - `career_user_graph_state`
- 关键调整：
  - `career_user_skill_nodes` 不保留 `cluster` 概念；隐藏图节点只表示稳定能力分支。
  - `career_user_skill_edges` Phase 1 只落 `prerequisite`。
  - `career_user_tree_preferences` 增加 `preference_version` 整数计数。
  - `career_user_graph_state` 负责 `graph_version` 递增、最近 merge provenance、用户级锁定状态。
  - `career_user_tree_snapshots` 增加 `schema_version`，`status` 扩为 `empty | pending | ready`。
- 旧表处理：
  - 不读取 `course_skill_mappings`、`course_chapter_skill_mappings`、旧 `skills/skill_relationships` 作为新链路真相源。
  - 旧表只在 cutover 前保留，切换完成后删除旧运行时依赖。

### 2. Flow A: 课程保存 / Backfill
- 触发：
  - 新建课程 outline
  - 更新课程 outline
  - 历史 backfill
- 步骤：
  1. 计算 `outline_hash`。
  2. 用 `extract:user:{userId}:course:{courseId}:outline:{outlineHash}` 做 extraction 幂等。
  3. 入队 `extract_course_evidence`，不在保存请求内同步跑 LLM。
  4. extractor 输出写入 `career_course_skill_evidence` 与 `career_course_chapter_evidence`，证据行按 extract run 不可变保存。
  5. 入队 `merge_user_skill_graph`。
  6. merge 前先移除该用户该课程**旧 outline 版本**在 `career_user_skill_node_evidence` 中的链接；旧 evidence 行保留做审计，但不再参与聚合。
  7. merge 事务内应用 attach/create 结果、重建该次新增的 prerequisite edges、重算受影响节点聚合值、递增 `graph_version`。
  8. merge 成功后入队 `compose_user_career_trees`。
  9. compose 成功后写新 snapshot，并将其设为 `is_latest=true`。
- merge 候选裁剪：
  - 代码先按 `canonical_label + summary + 历史 evidence title/snippet` 做词法检索。
  - 每条新 evidence 取 top 8 候选节点。
  - 合并去重后最多向 merge planner 提供 40 个节点、60 条历史 node-evidence links、40 条 prerequisite edges。
  - 图小于上限时传全量。
  - 这一步只裁上下文，不替 AI 做 attach/create 语义决策。

### 3. Flow B: 用户选主树
- `PUT /api/user/golden-path` 只做：
  1. 校验 `selectedDirectionKey`
  2. 写入 `career_user_tree_preferences.selected_direction_key`
  3. `preference_version += 1`
  4. 入队 compose
  5. 返回 `202 Accepted`
- 第一版不在 `PUT` 里同步返回新 snapshot。
- `recommended_direction_key` 保持独立；用户选择只作为后续排序偏好信号，不覆盖 AI 推荐。

### 4. Flow C: 页面读
- `GET /api/user/golden-path` 只读 snapshot。
- 返回规则：
  - 没有已保存课程：`status = "empty"`
  - 有课程但没有成功 snapshot：`status = "pending"`
  - 有成功 snapshot：返回最新成功 snapshot
  - 有新 compose 在跑且旧 snapshot 存在：继续返回旧 `ready` snapshot，不降级为 `pending`
- 页面读路径可以在“有课程但无 snapshot”时**幂等入队** compose，但不能同步执行 LLM。

### 5. AI 合约
- 全部 AI 步骤使用 AI SDK v6 结构化 JSON 输出 + Zod 严格校验。
- Prompt 放在 `lib/ai/prompts/resources/career-tree/`，流程编排在 `lib/career-tree/*.ts`。

- Course Extractor：
  - 输入：课程标题、描述、outline、显式 `courseSkillIds`、显式 `chapter.skillIds`
  - 输出：skills/themes/tools/workflows/concepts 的证据项
  - 禁止输出 progress/state
  - 显式 skill ids 只作为高置信上下文，不强制原样输出

- Merge Planner：
  - 输入：当前用户的候选隐藏节点子集、其 prerequisite edges、新 evidence rows、同课程旧链接摘要
  - 输出：`attach` / `create` 决策，以及 prerequisite edge 决策
  - 代码护栏：
    - `targetNodeId` 必须属于当前用户
    - `evidenceIds` 必须来自当前 extract run
    - 单次课程 merge 最多新建 20 个节点、40 条边
    - 拒绝 self-edge
    - 检测并丢弃 prerequisite cycle

- Tree Composer：
  - 输入：完整用户隐藏图、最新偏好、上一版 snapshot 的树 key 和 supporting node refs 摘要
  - 输出：`1-5` 棵候选职业树
  - 规则：
    - 弱信号返回 `1-2` 棵
    - 强信号返回 `2-5` 棵
    - 可以自由重命名和重组可见节点
    - 不得发明不存在的 `anchorRef`
    - 不得发明 progress/state

## Public APIs / Types
- 新读模型：
```ts
interface GoldenPathSnapshot {
  schemaVersion: 1;
  status: "empty" | "pending" | "ready";
  recommendedDirectionKey: string | null;
  selectedDirectionKey: string | null;
  trees: CandidateCareerTree[];
  generatedAt: string | null;
}
```

```ts
interface CandidateCareerTree {
  directionKey: string;
  title: string;
  summary: string;
  confidence: number; // 0..1
  whyThisDirection: string;
  supportingCourses: SupportingCourseRef[];
  supportingChapters: SupportingChapterRef[];
  tree: VisibleSkillTreeNode[];
}
```

```ts
interface VisibleSkillTreeNode {
  id: string;
  anchorRef: string; // equals career_user_skill_nodes.id
  title: string;
  summary: string;
  progress: number; // 0..100
  state: "mastered" | "in_progress" | "ready" | "locked";
  children: VisibleSkillTreeNode[];
  evidenceRefs?: string[];
}
```

- 内部字段约定：
  - `supportingNodeRefs`
  - `matchPreviousDirectionKey`
  - `keySeed`
- 这些字段属于 **compose 内部元数据**，用于 key 继承和调试：
  - 允许存在于 `career_generation_runs.output_json`
  - 不属于 `GET /api/user/golden-path` 的公开 payload

- `directionKey` 规则：
  1. composer 输出 `matchPreviousDirectionKey`、`keySeed`、`supportingNodeRefs`
  2. 代码先按 `supportingNodeRefs` 与上一版成功 compose 的内部元数据做 Jaccard overlap 匹配
  3. overlap `>= 0.45` 时继承旧 `directionKey`
  4. 否则用 `keySeed` slug 化生成新 key
  5. 当前 snapshot 内冲突时追加 `-2/-3`
- `anchorRef` 直接使用隐藏节点 id；不再引入单独锚点命名空间。
- 可见节点 `id` 使用 `${directionKey}:${anchorRef}:${pathIndex}`，仅保证单快照内稳定。

## Aggregation Rules
- 代码而不是 AI 计算 `progress`、`mastery_score`、`evidence_score`、`state`。
- 课程进度输入：
  - evidence 有 chapter refs 时，按对应 chapter completion ratio 聚合
  - evidence 无 chapter refs 时，退回课程整体 progress
- 计算：
  - `progress = round(weighted mean of linked completion ratios, weight = evidence confidence)`
  - `evidence_score = clamp(round(sum(weighted evidence support normalized to 0..100)), 0, 100)`
  - `mastery_score = clamp(round(progress * 0.7 + min(20, course_count * 5) + min(10, repeatedEvidenceCount * 2)), 0, 100)`
  - `course_count = distinct linked courses`
  - `chapter_count = distinct linked chapters`
- 状态常量：
  - `MASTERED_PROGRESS_THRESHOLD = 80`
  - `MASTERED_EVIDENCE_THRESHOLD = 60`
  - `IN_PROGRESS_THRESHOLD = 30`
  - `READY_PREREQ_PROGRESS_THRESHOLD = 50`
- 状态规则：
  - `mastered`: `progress >= 80 && evidence_score >= 60`
  - `in_progress`: `progress >= 30`
  - `ready`: `progress < 30` 且所有 prerequisite source nodes 的 `progress >= 50`，或根本没有 prerequisite edges
  - `locked`: 存在 prerequisite source node 的 `progress < 50`

## Stability / Identity Rules
- 隐藏连续性：
  - 由 `career_user_skill_nodes.id` 保证
  - 同一用户多次再生成时，旧 node id 必须优先复用
- 课程版本边界：
  - `career_course_skill_evidence` 与 `career_course_chapter_evidence` 均绑定 `source_outline_hash`
  - merge 只将**当前 course 最新 outline_hash 对应的 evidence**链接入隐藏图
  - 旧 evidence 行保留审计，不参与当前聚合
- 章节 identity：
  - Phase 1 使用 `chapter_key = "chapter-" + (chapterIndex + 1)`
  - 因为 evidence 已绑定 `source_outline_hash`，章节 key 只要求在单个 course version 内稳定

## Jobs / Idempotency / Failure
- 背景任务：
  - `extract_course_evidence`
  - `merge_user_skill_graph`
  - `compose_user_career_trees`
  - `backfill_user_career_trees`
- 执行模型：
  - queue-only
  - 每个用户同一时刻最多一个 merge job
  - 每个用户同一时刻最多一个 compose job
- 幂等 key：
  - extraction: `extract:user:{userId}:course:{courseId}:outline:{outlineHash}`
  - merge: `merge:user:{userId}:course:{courseId}:extract_run:{runId}`
  - compose: `compose:user:{userId}:graph:{graphVersion}:pref:{preferenceVersion}`
- 失败策略：
  - extraction 失败：不改隐藏图，不改 snapshot
  - merge 失败：事务回滚，不做部分写入
  - compose 失败：保留上一版 `ready` snapshot，不清空 latest successful

## UI / Cutover
- 更新：
  - [app/golden-path/page.tsx](/Users/findbiao/projects/nexusnote/app/golden-path/page.tsx)
  - [components/golden-path/GoldenPathExplorer.tsx](/Users/findbiao/projects/nexusnote/components/golden-path/GoldenPathExplorer.tsx)
  - [components/profile/ProfileGoldenPathSummary.tsx](/Users/findbiao/projects/nexusnote/components/profile/ProfileGoldenPathSummary.tsx)
  - [app/api/user/golden-path/route.ts](/Users/findbiao/projects/nexusnote/app/api/user/golden-path/route.ts)
- UI 行为：
  - 展示 AI 推荐树与其他候选树
  - 当前选中树与推荐树同时可见
  - 不再出现固定 `routes / futureRoutes / golden-path ontology` 文案
  - `pending` 时展示生成中状态，不展示伪树
- Cutover：
  1. 新 schema + jobs + snapshot read model 落地
  2. backfill 有已保存课程的用户
  3. 切换 `GET /api/user/golden-path` 到新 snapshot
  4. 删除旧 projection 逻辑与 ontology 运行时依赖

## Defaults Chosen
- 模型：新增统一策略 `CAREER_TREE_JSON`，Phase 1 底层绑定到**当前 interview outline 流程所用的结构化输出主模型**，extract / merge / compose 全部先用同一模型，减少模型分叉。
- 图版本：使用 `career_user_graph_state.graph_version` 的整数递增，不用派生 hash。
- 偏好版本：使用 `career_user_tree_preferences.preference_version` 的整数递增。
- Edge Phase 1：只上 `prerequisite`。
- 不引入全站 canonical skill universe。
- 不引入 page-time generation。
- 不复用旧 mapping tables。

## Test Plan
- Consistency：
  - 同一用户、同一批课程，多次 compose 后隐藏 node ids 连续
  - 可见节点允许改名，但进度不重置
- Growth：
  - 新增一门课程时，优先生长旧枝条；新建节点数不超过课程 cap
- Weak Signal：
  - 只返回 `1-2` 棵高置信树
- Strong Signal：
  - 返回 `2-5` 棵候选树
- Preference：
  - `selectedDirectionKey` 改变后，下一版 snapshot 排序受偏好影响
  - `recommendedDirectionKey` 仍独立存在
- Snapshot Read：
  - 无课程 => `empty`
  - 有课程无成功 snapshot => `pending`
  - compose 失败 => 保留上一版 `ready`
- Failure / Idempotency：
  - 同 outline 重复保存不会重复抽取
  - merge 失败不会残留半写入图
  - compose 失败不会丢 latest successful snapshot
- Engineering Baseline：
  - `bun run typecheck`
  - `bun run lint`
  - 增加 fixture 驱动的 extraction / merge / compose 稳定性脚本

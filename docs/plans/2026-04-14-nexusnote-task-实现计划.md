# NexusNote Task 实现计划

## 文档目的

这份文档不是愿景文档，而是执行文档。

它回答四个问题：

1. 先做什么
2. 后做什么
3. 每一阶段改哪些模块
4. 每一阶段做到什么程度算完成

## 当前代码现实

现在代码已经具备的基础有：

- 新职业树链路骨架已经存在：
  - `lib/career-tree/*`
  - `db/schema/career-tree.ts`
  - `app/api/user/golden-path/route.ts`
  - `components/golden-path/GoldenPathExplorer.tsx`
  - `components/profile/ProfileGoldenPathSummary.tsx`
- queue / worker 骨架已经存在：
  - `lib/queue/career-tree-queue.ts`
  - `lib/queue/career-tree-worker.ts`
- 页面主读链路已经切到新 snapshot 模型
- 旧 golden-path runtime 已经基本退出代码主链路

还没有闭环的部分有：

- 数据库迁移
- backfill
- 真实 extract -> merge -> compose 落库验证
- fixture 驱动稳定性测试

所以执行顺序必须现实一点：

> 先闭环职业树，再扩 evidence，再做 insight，再做真正液态回流。

同时要提前锁住一个长期方向：

> Phase 2 开始，统一知识层不再直接围绕页面对象建模，而是围绕 `evidence event` 建模。

---

# Phase 1：职业树闭环

## 目标

让 AI 多候选职业树从“代码骨架”变成“真实可运行系统”。

## 本阶段完成后用户能得到什么

- `/golden-path` 读到真实 snapshot
- 能看到 `1-5` 棵候选职业树
- 用户手动选树会影响后续排序
- 隐藏能力分支前后连续，不会每次重置

## 范围

### 1. 迁移与落库

落地并验证这些表：

- `career_generation_runs`
- `career_course_skill_evidence`
- `career_course_chapter_evidence`
- `career_user_skill_nodes`
- `career_user_skill_edges`
- `career_user_skill_node_evidence`
- `career_user_tree_preferences`
- `career_user_tree_snapshots`
- `career_user_graph_state`

### 2. 跑通三段式任务

- `extract_course_evidence`
- `merge_user_skill_graph`
- `compose_user_career_trees`

### 3. 跑通 backfill

对应脚本：

- [scripts/backfill-career-trees.ts](/Users/findbiao/projects/nexusnote/scripts/backfill-career-trees.ts)

### 4. 验证前端链路

对应页面与组件：

- [app/golden-path/page.tsx](/Users/findbiao/projects/nexusnote/app/golden-path/page.tsx)
- [components/golden-path/GoldenPathExplorer.tsx](/Users/findbiao/projects/nexusnote/components/golden-path/GoldenPathExplorer.tsx)
- [components/profile/ProfileGoldenPathSummary.tsx](/Users/findbiao/projects/nexusnote/components/profile/ProfileGoldenPathSummary.tsx)

## 主要改动模块

- [lib/career-tree/normalize-outline.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/normalize-outline.ts)
- [lib/career-tree/extract.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/extract.ts)
- [lib/career-tree/retrieve-merge-candidates.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/retrieve-merge-candidates.ts)
- [lib/career-tree/merge.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/merge.ts)
- [lib/career-tree/compose.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/compose.ts)
- [lib/career-tree/jobs.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/jobs.ts)
- [lib/career-tree/snapshot.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/snapshot.ts)
- [lib/career-tree/preferences.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/preferences.ts)
- [lib/career-tree/preference-write.ts](/Users/findbiao/projects/nexusnote/lib/career-tree/preference-write.ts)
- [app/api/user/golden-path/route.ts](/Users/findbiao/projects/nexusnote/app/api/user/golden-path/route.ts)

## 验收标准

### 功能
- 同一用户、同一批课程多次 compose 后隐藏 node 连续
- 弱信号用户返回 `1-2` 棵高置信树
- 强信号用户返回 `2-5` 棵候选树
- `PUT /api/user/golden-path` 返回 `202`
- `GET /api/user/golden-path` 只读 snapshot

### 工程
- `bun run lint`
- `bun run typecheck`
- `SKIP_ENV_VALIDATION=true bun run build`
- fixture 稳定性脚本通过

## 成本

- 工程工作量：`2-4 天`
- 风险：中

---

# Phase 2：统一 Evidence 层

## 目标

让课程之外的知识来源也进入同一套知识证据体系。

## 为什么这一步重要

如果只做完职业树，系统仍然只是：

- 课程驱动成长图

而不是：

- 课程 / 高亮 / 笔记 / 对话共同驱动成长图

只有统一 evidence 层建立，知识才开始真正流动。

这一步的长期正确做法不是继续让所有来源直接写入最终 evidence，而是：

1. 先统一写入 `evidence event`
2. 再把 event 聚合成稳定 evidence
3. 再从 evidence 派生 insight 和 growth graph

## 本阶段完成后会发生什么

- 高亮会先变成 `highlight evidence event`
- 笔记会先变成 `note evidence event`
- 对话 capture 会先变成 `capture evidence event`
- 课程抽取会变成 `course evidence event`
- 成长图不再只靠课程大纲更新

## 新模块建议

新增：

- `lib/knowledge/events/`
- `lib/knowledge/events/types.ts`
- `lib/knowledge/events/ingest/`
- `lib/knowledge/events/selectors/`
- `lib/knowledge/evidence/`
- `lib/knowledge/evidence-types.ts`
- `lib/knowledge/evidence-ingest/`
- `lib/knowledge/evidence-selectors/`

## 主要现有入口

- [app/api/learn/annotations/route.ts](/Users/findbiao/projects/nexusnote/app/api/learn/annotations/route.ts)
- [app/api/notes/capture/route.ts](/Users/findbiao/projects/nexusnote/app/api/notes/capture/route.ts)
- [app/api/notes/capture-chat/route.ts](/Users/findbiao/projects/nexusnote/app/api/notes/capture-chat/route.ts)
- [lib/server/learn-data.ts](/Users/findbiao/projects/nexusnote/lib/server/learn-data.ts)
- [components/editor](/Users/findbiao/projects/nexusnote/components/editor)
- [lib/chat](/Users/findbiao/projects/nexusnote/lib/chat)

## 本阶段新增表方向

开始引入 event-first 的知识层：

- `knowledge_evidence_events`
- `knowledge_evidence_event_refs`

在 event 稳定后，再引入：

- `knowledge_evidence`
- `knowledge_evidence_source_links`

说明：

- 这一步不要求立即删除 `career_*`
- 但要明确 `career_*` 不再是最终数据模型
- 也不建议再让页面数据直接越过 event 层写入最终 evidence

## 验收标准

- 课程外行为可写入统一 evidence event
- evidence event 可被稳定聚合成 evidence
- evidence 能和隐藏能力图建立联系
- growth graph 更新不再只依赖课程 outline

## 成本

- 工程工作量：`4-7 天`
- 风险：中高

---

# Phase 3：Insight 层

## 目标

建立介于 raw evidence 和页面之间的稳定解释层。

## 为什么要有这层

如果没有 insight 层，后面会越来越乱：

- 职业树直接吃 raw evidence
- Editor 直接吃 raw notes
- Profile 直接拼多个来源
- 对话解释只能每次临时现编

Insight 层的作用就是把系统从“会存东西”升级成“会理解结构”。

## 本阶段完成后会发生什么

- 系统能提炼：
  - 主题
  - 缺口
  - 强项
  - 轨迹
  - 推荐理由
- 职业树解释更稳定
- Editor 和 Profile 都能读同一层中间语义

## 新模块建议

- `lib/knowledge/insights/`
- `lib/knowledge/insight-jobs/`
- `lib/knowledge/insight-selectors/`

## 新增表

- `knowledge_insights`
- `knowledge_insight_evidence`

## 主要消费方

- [components/profile/ProfileGoldenPathSummary.tsx](/Users/findbiao/projects/nexusnote/components/profile/ProfileGoldenPathSummary.tsx)
- [components/golden-path/GoldenPathExplorer.tsx](/Users/findbiao/projects/nexusnote/components/golden-path/GoldenPathExplorer.tsx)
- Editor 工作台
- 未来学习焦点推荐

## 验收标准

- 职业树可用稳定解释理由
- Profile 可展示“成长信号”而不是只是数量
- Editor 可展示主题级知识沉淀

## 成本

- 工程工作量：`4-6 天`
- 风险：中

---

# Phase 4：真正液态的双向回流

## 目标

让系统不仅记录学习，还能根据沉淀下来的知识结构重新调整后续学习。

## 本阶段完成后会发生什么

系统具备这些回流链：

1. 课程 -> 成长图
2. 高亮 -> 成长图
3. 笔记 -> 成长图
4. 对话 -> 成长图
5. 成长图 -> 下一步焦点
6. 下一步焦点 -> 课程组织
7. insight -> 后续课程生成
8. 用户偏好 -> 长期排序偏置

## 主要改动模块

- [app/api/interview/create-course/route.ts](/Users/findbiao/projects/nexusnote/app/api/interview/create-course/route.ts)
- [lib/learning/course-service.ts](/Users/findbiao/projects/nexusnote/lib/learning/course-service.ts)
- [lib/ai/workflows/generate-course-section.ts](/Users/findbiao/projects/nexusnote/lib/ai/workflows/generate-course-section.ts)
- [lib/ai/agents/chat.ts](/Users/findbiao/projects/nexusnote/lib/ai/agents/chat.ts)
- [components/golden-path](/Users/findbiao/projects/nexusnote/components/golden-path)
- [components/profile](/Users/findbiao/projects/nexusnote/components/profile)
- 未来的 `lib/knowledge/focus/`

## 新增投影

- `user_focus_snapshots`
- `user_profile_snapshots`

## 验收标准

- 新 evidence 到来后，当前焦点会变化
- 职业树变化会影响后续学习建议
- 后续课程生成开始消费隐藏能力图 / insight
- 页面开始真正读同一套底层知识流的不同投影

## 成本

- 工程工作量：`7-12 天`
- 风险：高

---

## 并行工作流：布局与页面家族重构

这不是知识层本体，但应并行推进。

### 目标

把产品页面收成三种页面家族：

1. `Landing`
2. `Workspace`
3. `Library / Analysis`

### 对应模块

- [components/shared/layout/FloatingHeader.tsx](/Users/findbiao/projects/nexusnote/components/shared/layout/FloatingHeader.tsx)

### 优先顺序

1. 首页
2. Editor
3. Profile
4. Insights / Settings

---

## 最终目标表族

### 来源层

- `courses`
- `course_outline_versions`
- `course_outline_nodes`
- `course_sections`
- `course_progress`
- `course_section_annotations`
- `conversations`
- `conversation_messages`
- `notes`
- `note_snapshots`

### 编排层

- `knowledge_generation_runs`

### 事件层

- `knowledge_evidence_events`
- `knowledge_evidence_event_refs`

### 证据层

- `knowledge_evidence`
- `knowledge_evidence_source_links`
- `knowledge_evidence_chunks`

### 洞察层

- `knowledge_insights`
- `knowledge_insight_evidence`

### 成长层

- `user_skill_nodes`
- `user_skill_edges`
- `user_skill_node_evidence`
- `user_growth_state`

### 投影层

- `user_career_tree_preferences`
- `user_career_tree_snapshots`
- `user_focus_snapshots`
- `user_profile_snapshots`

---

## 旧结构退出清单

以下结构不属于最终目标：

- `course_skill_mappings`
- `course_chapter_skill_mappings`
- 旧 golden-path runtime
- 旧固定 route 语义
- 旧全站 canonical skill 主链路

如果未来需要全站 canonical 层，那是更后面的增强项，不是当前主链路。

---

## 推荐执行顺序

最合理的顺序是：

1. **Phase 1 真闭环**
2. **Phase 2 统一 evidence**
3. **Phase 3 增加 insight**
4. **Phase 4 做双向回流**

不要跳着做。

真正危险的不是“不够宏大”，而是：

> 在第一阶段没有真正跑稳之前，就把系统做成过度设计的半成品。

---

## 最终判断

当下面四件事同时成立时，NexusNote 才会真正成为知识操作系统：

1. 成长连续性稳定
2. evidence 统一
3. insight 可复用
4. 课程、对话、笔记、职业树共享同一套底层知识流

这份实现计划，就是沿着这条路把它做出来。

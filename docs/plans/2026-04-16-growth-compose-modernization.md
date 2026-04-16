# Growth Compose 现代化重构说明

## 背景

2026-04-16 的真实检查结果表明，`growth` 当前最脆的环节不是 hidden graph，也不是 snapshot/projection，而是 compose：

- `bun run growth:check` 通过，说明确定性图和投影视图主链路是稳定的
- `bun run ai:eval growth` 失败，说明真正不稳的是 AI compose
  - 强信号 case：超时，约 90s
  - 弱信号 case：结构化输出不匹配 schema

这意味着问题不在“growth 全架构错误”，而在“compose 这一步把过多职责塞进一次模型调用”。

## 这次审出的核心问题

### 1. one-shot compose 承担了四种不同职责

旧版 [compose.ts](/Users/findbiao/projects/nexusnote/lib/growth/compose.ts) 让单次模型调用同时负责：

- 候选方向规划
- 树拓扑组织
- 推荐方向判断
- 用户可见文案生成

这会把语义规划、结构生成、身份连续性、表现层 copy 全绑在一个 schema 里，天然脆弱。

### 2. 模型输出后还有第二层强业务校验

旧链路不是“模型生成一次就结束”，而是：

1. 模型输出完整多树 JSON
2. 代码再校验 supporting refs、anchor refs、方向 hint、唯一性、previous match

这让模型必须一次性命中“语义正确 + 结构完整 + 业务闭合”，失败面很大。

### 3. truth layer 和 presentation layer 混在一起

旧版把这些东西放在同一层生成：

- 真相层：`supportingNodeRefs`、树结构、推荐方向
- 表现层：标题、summary、whyThisDirection、节点文案

其中前者必须稳定、可校验、可连续；后者本质是 UI 叙述。把两层混在一起，是这次不稳的根源之一。

### 4. 这不是 skills / sub-agents 更适合的场景

`growth compose` 是：

- 强状态
- 强连续性
- 强 grounding
- 需要稳定 key 和 snapshot

所以它更适合 fixed workflow + deterministic core，而不是开放式 sub-agent 运行时，更不是把 skills 当真相源。

## 重构决策

保留现有主链：

`evidence -> hidden graph -> compose -> snapshot -> projection`

只重写 compose 的内部形态，改成三段式：

1. **Direction Planner（AI）**
2. **Deterministic Tree Builder（code）**
3. **Direction Metadata Narrator（AI）**

## 新职责划分

### 1. Direction Planner

文件：

- [compose-planner.ts](/Users/findbiao/projects/nexusnote/lib/growth/compose-planner.ts)
- [compose.md](/Users/findbiao/projects/nexusnote/lib/ai/prompts/resources/growth/compose.md)

职责：

- 只规划方向骨架
- 只输出：
  - `recommendedDirectionIndex`
  - `keySeed`
  - `supportingNodeRefs`
  - `matchPreviousDirectionKey`

它不再输出树结构，也不再写用户文案。

### 2. Deterministic Tree Builder

文件：

- [compose-layout.ts](/Users/findbiao/projects/nexusnote/lib/growth/compose-layout.ts)

职责：

- 基于 `supportingNodeRefs + prerequisiteEdges` 确定性建树
- 选择单父边，避免一棵树里重复节点
- 保证每个 hidden node 在同一棵树里只出现一次

这一步完全由代码控制，不再交给模型。

### 3. Direction Metadata Narrator

文件：

- [compose-metadata.ts](/Users/findbiao/projects/nexusnote/lib/growth/compose-metadata.ts)
- [compose-metadata.md](/Users/findbiao/projects/nexusnote/lib/ai/prompts/resources/growth/compose-metadata.md)

职责：

- 基于已经确定的方向骨架和树结构，生成：
  - `title`
  - `summary`
  - `whyThisDirection`
  - 节点标题与节点摘要

这一步只做 presentation，不碰 truth。

## 为什么这样更现代

不是因为“拆得更多”，而是因为职责边界终于对了：

- AI 负责语义规划和用户叙述
- 代码负责结构、连续性、确定性和业务约束
- 推荐与偏好继续分离
- hidden graph、snapshot、projection 继续复用，不制造新真相源

这比 one-shot 大 JSON 更符合 2026 的 agent/workflow 实践：先把确定性核心收口，再把 AI 放在真正适合它的窄职责上。

## 为什么不是 skills / sub-agents

### skills 不适合 runtime truth

skills 适合做复用能力包、解释器、策略器，不适合承载：

- 方向连续身份
- hidden graph merge
- snapshot compose 真相

### sub-agents 不适合强状态 compose

sub-agents 更适合探索、分析、批处理总结。`growth compose` 需要：

- 稳定 identity
- 稳定 grounding
- 稳定排序

这类任务必须让代码当主心骨，不能交给开放式 agent runtime。

## 实施结果

这次重构后：

- `compose.ts` 只负责 orchestrate / validate / sort / stable key
- 树拓扑不再由模型决定
- 输出 schema 保持不变，snapshot/projection 链路不需要跟着重写
- prompt version 升级到 `growth-compose@v4`

## 非目标

这次不处理：

- hidden graph 的表迁移
- growth 之外的 interview / notes 稳定性问题
- 用 skills/sub-agents 重写 growth runtime

## 验证标准

- `bun run lint`
- `bun run typecheck`
- `bun run growth:check`
- `bun run ai:eval growth`

只有以上通过，才算这次 compose 重构真正落地。

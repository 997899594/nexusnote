# 动态访谈系统：基于信息熵的连续状态评估架构

> 2026-03-04 | 状态：设计阶段

## 概述

本文档描述了 NexusNote 访谈系统的下一代架构：从"动态表单"思维走向"基于信息熵的连续状态评估"。

### 核心理念

- **没有预设的 Slot** — AI 的目标不是"填表"，而是"将信息饱和度提升至 80% 以上"
- **EAV 模型** — 实体-属性-值存储，告别 `z.any()` 的类型裸奔
- **原生 Topic Drift** — 用户随时可以改变主意
- **零延迟评估** — LLM 生成规则，代码执行规则

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户说"我想学 K8s"                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  异步后台任务 (Blueprint Generation)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LLM (4o-mini) 生成评分蓝图:                             │    │
│  │  - "编程基础" (权重 30, keywords: ["语言", "经验"])       │    │
│  │  - "目标" (权重 25, keywords: ["为了", "目的"])          │    │
│  │  - "环境" (权重 20, keywords: ["系统", "设备"])          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                       ↓ 存入 DB                                │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌───────────────────┐                    ┌───────────────────┐
│  Agent 主线程      │                    │  蓝图已缓存        │
│  立即回复用户       │                    │  等待匹配          │
│  (0ms 延迟)       │                    │                   │
└───────────────────┘                    └───────────────────┘
        │
        ▼  用户回复
┌───────────────────────────────────────────────────────────────────┐
│  commitAndEvaluate 工具                                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  动态注入: "已有维度 [编程基础, 目标]"                        │  │
│  │  → LLM 自动对齐: "代码经验" → "编程基础"                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  本地规则评估 (evaluateSaturationLocally)                    │  │
│  │  - 遍历蓝图维度                                              │  │
│  │  - 关键词匹配 extractedFacts                                 │  │
│  │  - 累加权重 → 饱和度                                         │  │
│  │  (0ms 延迟, 0 API 成本)                                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  返回: { saturation: 65%, missing: ["环境"], isReady: false }     │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼  Agent 继续对话，按 missing 提问
```

---

## 问题分析

### 当前架构的痛点

**1. 固定字段问题**

```typescript
// 当前 InterviewProfile - 硬编码字段
interface InterviewProfile {
  background: string | null;      // 学做菜真的需要这个？
  currentLevel: LearningLevel;    // K8s 源码分析也用这个？
  targetOutcome: string | null;
  timeConstraints: string | null;
  // ...
}
```

不同主题需要不同信息：
- 学做菜 → 设备、口味、经验
- 学 K8s → Go 水平、使用经验、目标
- 学画画 → 风格偏好、工具、时间

**2. 维度膨胀问题**

AI 提取出"编程基础"和"代码经验"，数据库里出现两个表达同一意思的 key。

**3. 评估延迟问题**

每次对话都调用 LLM 评估饱和度 → 500ms+ 延迟 + 成本累积

**4. Topic Drift 无法处理**

用户中途换话题，AI 会像人工智障一样坚持问完上一个话题的问题。

---

## 解决方案

### 方案 1：动态上下文注入（解决维度膨胀）

**核心思想**：在源头约束，而非事后清洗。

```typescript
// 每次 Agent 准备调用工具前，动态获取该用户已有的维度
const existingDimensions = profile.extractedFacts.map(f => f.dimension);
// 例如: ["编程基础", "设备"]

export const commitAndEvaluate = tool({
  description: `提取用户事实。
⚠️ 极端重要：当前已存在的维度有 [${existingDimensions.join(", ")}]。
如果用户的新信息属于这些已有维度，你必须【严格使用上述完全一致的字符串】覆盖它。
只有当信息完全不属于已有维度时，你才可以创造一个简短的新维度名词（如"预算"）。`,
  parameters: z.object({
    newFacts: z.array(z.object({
      dimension: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
      type: z.enum(['string', 'number', 'boolean']),
    }))
  }),
  execute: async (args) => {
    // Upsert 逻辑：相同 dimension 自动覆盖
    const factMap = new Map(profile.extractedFacts.map(f => [f.dimension, f]));

    for (const fact of args.newFacts) {
      factMap.set(fact.dimension, fact);
    }

    profile.extractedFacts = Array.from(factMap.values());
    // ...
  }
});
```

**为什么有效**：大模型极其擅长阅读理解。只要把 `existingDimensions` 告诉它，它在生成 JSON 时会自动完成语义匹配。

### 方案 2：异构双引擎架构（解决评估延迟）

**核心思想**：LLM 生成规则 + TS 本地极速运算。

**Step 1: 异步蓝图生成（一次性）**

```typescript
// 后台任务，在新话题确立时触发
async function generateTopicBlueprint(topic: string) {
  const blueprintSchema = await llm.generateObject({
    prompt: `我要为一个想学《${topic}》的用户做访谈。请生成一个打分权重的蓝图。
    列出 3-5 个核心评估维度，以及每个维度的权重（总和100）。`,
    schema: z.object({
      coreDimensions: z.array(z.object({
        keywords: z.array(z.string()), // ["基础", "经验", "年限"]
        weight: z.number(),            // 30
        suggestion: z.string()         // "询问用户的编程语言基础"
      }))
    })
  });

  await db.cacheBlueprint(topic, blueprintSchema);
}
```

**Step 2: 本地极速评估（每次对话）**

```typescript
// 0ms 延迟，0 API 成本
function evaluateSaturationLocally(topic: string, extractedFacts: Fact[]) {
  const blueprint = db.getBlueprint(topic);
  if (!blueprint) return { score: 0, missing: [] };

  let currentScore = 0;
  const missingSuggestions = [];

  for (const dim of blueprint.coreDimensions) {
    // 简单的关键词匹配
    const isMatched = extractedFacts.some(fact =>
      dim.keywords.some(kw => fact.dimension.includes(kw))
    );

    if (isMatched) {
      currentScore += dim.weight;
    } else {
      missingSuggestions.push(dim.suggestion);
    }
  }

  return {
    score: currentScore,
    isSaturated: currentScore >= 80,
    nextQuestions: missingSuggestions
  };
}
```

---

## 数据模型

### 课程状态

```typescript
// types/interview.ts

export interface CourseProfileState {
  id: string;
  currentTopic: string;

  // EAV 事实集合（替代扁平 JSONB）
  extractedFacts: Array<{
    dimension: string;                    // 维度名
    value: string | number | boolean;     // 值
    type: 'string' | 'number' | 'boolean';
    confidence: number;                   // 置信度 (0-1)
    extractedAt: Date;                    // 提取时间
  }>;

  // 信息饱和度 (0 - 100%)
  saturationScore: number;

  // 系统建议的下一步提问方向
  nextHighValueDimensions: string[];

  // 蓝图缓存 ID
  blueprintId?: string;
}
```

### 评分蓝图

```typescript
// types/blueprint.ts

export interface TopicBlueprint {
  id: string;
  topic: string;
  topicHash: string;  // 用于快速匹配

  coreDimensions: Array<{
    name: string;
    keywords: string[];
    weight: number;
    suggestion: string;
  }>;

  generatedAt: Date;
  modelUsed: string;  // 记录生成模型
}
```

---

## 工具设计

### commitAndEvaluate（核心工具）

```typescript
export const commitAndEvaluate = tool({
  description: "从用户的最新回复中提取事实并提交。系统会自动评估当前的信息饱和度，并指导你下一步该问什么。",
  parameters: z.object({
    newFacts: z.array(z.object({
      dimension: z.string().describe("提取出的信息维度"),
      value: z.union([z.string(), z.number(), z.boolean()]),
      type: z.enum(['string', 'number', 'boolean']),
    })).describe("本次对话提取到的新事实"),

    topicDrift: z.object({
      isChanged: z.boolean().describe("用户是否改变了想学的主题？"),
      newTopic: z.string().optional().describe("如果改变了，新的主题是什么？")
    }).describe("话题漂移检测")
  }),

  execute: async (args, context) => {
    const profile = await db.getProfile(context.courseId);

    // 处理话题转移
    if (args.topicDrift.isChanged && args.topicDrift.newTopic) {
      profile.currentTopic = args.topicDrift.newTopic;
      profile.extractedFacts = [];

      // 触发异步蓝图生成
      generateTopicBlueprint(args.topicDrift.newTopic).catch(console.error);
    }

    // 合并新事实 (Upsert)
    const factMap = new Map(profile.extractedFacts.map(f => [f.dimension, f]));
    for (const fact of args.newFacts) {
      factMap.set(fact.dimension, {
        ...fact,
        confidence: 0.9,
        extractedAt: new Date()
      });
    }
    profile.extractedFacts = Array.from(factMap.values());

    // 本地评估饱和度
    const evaluation = evaluateSaturationLocally(
      profile.currentTopic,
      profile.extractedFacts
    );

    // 更新数据库
    await db.updateProfile(context.courseId, {
      ...profile,
      saturationScore: evaluation.score,
      nextHighValueDimensions: evaluation.missing
    });

    return {
      currentSaturation: evaluation.score,
      isReadyForOutline: evaluation.isSaturated,
      suggestedNextQuestions: evaluation.nextQuestions
    };
  }
});
```

---

## Agent 编排

### Prompt（目标驱动）

```typescript
const SYSTEM_PROMPT = `
你是 NexusNote 的高级学术向导。你的目标是深入了解用户，以便为他们生成高度定制化的课程大纲。

## 你的工作方式 (Entropy-Driven Flow)

1. **自然对话**：像资深导师一样与用户聊天，不要机械连问。每次只问一个核心问题。

2. **提取与提交**：每次用户回复后，调用 \`commitAndEvaluate\` 将你发现的客观事实提交给系统。

3. **听从系统指引**：工具返回结果后，查看 \`currentSaturation\`（饱和度）和 \`suggestedNextQuestions\`（建议提问方向）。
   - 顺着系统的建议方向，用你自然的口吻向用户提问。

4. **从容应对跑题**：如果用户突然想学别的东西，在调用工具时将 \`topicDrift.isChanged\` 设为 true 即可。

## 终结条件

当工具返回 \`isReadyForOutline: true\` 时（通常饱和度 > 80%），说明信息已经足够。
此时，**停止提问**，直接调用 \`generateOutline\` 工具为用户生成大纲。
`;
```

---

## 性能对比

| 场景 | 旧架构 | 新架构 |
|------|--------|--------|
| 首次响应延迟 | ~500ms (等待 Schema 生成) | ~0ms (直接对话) |
| 每轮评估延迟 | ~500ms (LLM 调用) | ~0ms (本地规则) |
| 每轮 API 成本 | ~$0.002 | $0 |
| Topic Drift | ❌ 崩溃 | ✅ 丝滑处理 |
| 维度标准化 | ❌ 脏数据 | ✅ 自动对齐 |

---

## 迁移路径

### Phase 1: 数据模型迁移
- 扩展 `InterviewProfile` 类型
- 添加 `extractedFacts`、`saturationScore` 字段
- 数据库迁移脚本

### Phase 2: 蓝图系统
- 创建 `topic_blueprints` 表
- 实现 `generateTopicBlueprint` 函数
- 实现蓝图缓存机制

### Phase 3: 工具重构
- 创建 `commitAndEvaluate` 工具
- 创建 `generateOutline` 工具
- 废弃旧工具 (`assessComplexity`, `updateProfile`, `suggestOptions`)

### Phase 4: Agent 重构
- 更新 Agent Prompt
- 集成新工具
- 测试 Topic Drift 场景

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 蓝图生成失败 | 无法评估饱和度 | 使用通用默认蓝图兜底 |
| 关键词匹配不准 | 评估偏差 | 支持同义词扩展 + 人工校准 |
| LLM 维度命名不稳定 | 事实重复 | 动态注入 + 后台异步合并 |

---

## 工程边界补丁（2026 生产级）

### 补丁 1：异步蓝图冷启动竞态条件

**问题**：用户快速回复时，蓝图可能还没生成完。

```
用户: "我想学 K8s"
      ↓ Agent 毫秒级回复
      ↓ 后台异步生成蓝图 (1.5s)
用户: "日常运维" (1s 后回复)
      ↓ commitAndEvaluate
      ↓ 蓝图还没生成完！
      ↓ evaluateSaturationLocally 返回 score: 0
```

**解决方案**：Event-Driven Re-evaluation

```typescript
// 1. 蓝图状态跟踪
interface BlueprintState {
  status: 'pending' | 'ready' | 'failed';
  pendingFacts: ExtractedFact[];  // 冷启动期暂存的事实
}

// 2. 评估函数改进
async function evaluateSaturation(topic: string, facts: ExtractedFact[]) {
  const blueprintState = await getBlueprintState(topic);

  if (blueprintState.status === 'pending') {
    // 暂存事实，返回 isReady: false
    await appendPendingFacts(topic, facts);
    return { score: 0, isReady: false, isBlueprintPending: true };
  }

  // 正常评估...
}

// 3. 蓝图生成完成时触发重算
async function onBlueprintReady(blueprint: TopicBlueprint) {
  const pendingFacts = await getAndClearPendingFacts(blueprint.topic);
  if (pendingFacts.length > 0) {
    // 重新评估所有暂存事实
    const evaluation = evaluateSaturationLocally(blueprint, pendingFacts);
    // 更新课程状态
    await updateCourseSaturation(blueprint.topic, evaluation);
  }
}
```

### 补丁 2：Blueprint-Aware Extraction

**问题**：`includes` 关键词匹配太脆弱。

```typescript
// 蓝图关键词: ["语言", "经验"]
// 用户说: "我是前端切图仔"
// AI 提取: dimension: "技术栈", value: "Vue/React"
// "技术栈".includes("语言") → false → 匹配失败
```

**解决方案**：把蓝图维度直接注入 Prompt

```typescript
// 动态注入蓝图维度
const blueprintDimensions = blueprint?.coreDimensions.map(d => d.name) || [];

export const commitAndEvaluate = tool({
  description: `提取用户事实。

⚠️ 极端重要：当前的主题蓝图规定了以下核心维度：
[${blueprintDimensions.join(", ")}]

你必须优先将用户的信息归类到上述标准维度中！
只有当信息极其特殊且重要时，才允许自创维度。`,
  // ...
});

// 本地评估简化：直接匹配维度名
function evaluateSaturationLocally(blueprint: TopicBlueprint, facts: ExtractedFact[]) {
  for (const dim of blueprint.coreDimensions) {
    // 精确匹配，不再用 includes
    const isMatched = facts.some(fact => fact.dimension === dim.name);
    // ...
  }
}
```

### 补丁 3：Topic Drift 软删除（Event Sourcing）

**问题**：硬删除导致数据丢失，用户反悔时无法恢复。

```
用户: "我想学 Python" → 收集了 3 轮信息
用户: "等等，我要学 Rust" → Topic Drift → 清空 facts
用户: "算了太难了，还是 Python 吧" → 之前的 Python 信息全丢了
```

**解决方案**：软隔离 + 共享事实

```typescript
interface ExtractedFact {
  dimension: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean';
  confidence: number;
  extractedAt: string;

  // 新增：归属主题
  topicId: string;

  // 新增：是否全局共享（如"设备=Mac"在所有技术主题都适用）
  isShared: boolean;
}

// Topic Drift 处理
if (args.topicDrift.isChanged && args.topicDrift.newTopic) {
  const newTopicId = generateTopicId(args.topicDrift.newTopic);

  // 不清空！只是后续 facts 打上新的 topicId
  profile.currentTopic = args.topicDrift.newTopic;
  profile.currentTopicId = newTopicId;

  // 全局共享事实（如设备、操作系统）仍然可用
  const sharedFacts = profile.extractedFacts.filter(f => f.isShared);
  // 新主题可以复用这些事实
}

// 评估时按 topicId 过滤
function getActiveFacts(profile: CourseProfileState): ExtractedFact[] {
  const currentTopicFacts = profile.extractedFacts.filter(
    f => f.topicId === profile.currentTopicId
  );
  const sharedFacts = profile.extractedFacts.filter(f => f.isShared);
  return [...currentTopicFacts, ...sharedFacts];
}
```

---

## 更新后的数据模型

```typescript
// types/interview-v2.ts

export interface ExtractedFact {
  dimension: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean';
  confidence: number;
  extractedAt: string;

  // 补丁 3：归属主题
  topicId: string;

  // 补丁 3：全局共享标记
  isShared: boolean;
}

export interface BlueprintState {
  topicHash: string;
  status: 'pending' | 'ready' | 'failed';
  pendingFacts: ExtractedFact[];
  blueprint?: TopicBlueprint;
}

export interface DynamicCourseProfile {
  currentTopic: string;
  currentTopicId: string;  // 补丁 3

  extractedFacts: ExtractedFact[];

  saturationScore: number;
  nextHighValueDimensions: string[];

  blueprintId?: string;
  blueprintStatus: 'pending' | 'ready' | 'failed';  // 补丁 1
}
```

---

## 参考资料

- [AI SDK v6 Advanced Features](../ai-sdk-v6-advanced-features.md)
- [AI Architecture 2026 Redesign](../AI_ARCHITECTURE_2026_REDESIGN.md)

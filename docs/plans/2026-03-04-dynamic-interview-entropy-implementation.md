# Dynamic Interview Entropy-Driven System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the interview system from fixed-slot form filling to entropy-driven continuous state assessment with dynamic fact extraction.

**Architecture:** EAV (Entity-Attribute-Value) model for facts, async blueprint generation with local rule-based evaluation, native Topic Drift support, zero-latency saturation scoring.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL JSONB, AI SDK v6, Zod

---

## Task 1: Define Types for Dynamic Interview System

**Files:**
- Create: `types/interview-v2.ts`

**Step 1: Create the types file**

```typescript
// types/interview-v2.ts

/**
 * 动态访谈系统类型定义
 * 基于信息熵的连续状态评估架构
 */

/**
 * 提取的事实 (EAV 模型)
 */
export interface ExtractedFact {
  dimension: string;                    // 维度名，如 "编程基础"、"设备"
  value: string | number | boolean;     // 值
  type: 'string' | 'number' | 'boolean';
  confidence: number;                   // 置信度 (0-1)
  extractedAt: string;                  // ISO 时间戳
}

/**
 * 评分蓝图维度
 */
export interface BlueprintDimension {
  name: string;                         // 维度名
  keywords: string[];                   // 匹配关键词
  weight: number;                       // 权重 (0-100)
  suggestion: string;                   // 建议提问
}

/**
 * 主题评分蓝图
 */
export interface TopicBlueprint {
  id: string;
  topic: string;
  topicHash: string;                    // topic 的 hash，用于快速匹配
  coreDimensions: BlueprintDimension[];
  generatedAt: string;
  modelUsed: string;
}

/**
 * 动态课程状态
 */
export interface DynamicCourseProfile {
  currentTopic: string;

  // EAV 事实集合
  extractedFacts: ExtractedFact[];

  // 信息饱和度 (0-100)
  saturationScore: number;

  // 系统建议的下一步提问方向
  nextHighValueDimensions: string[];

  // 蓝图 ID
  blueprintId?: string;
}

/**
 * 评估结果
 */
export interface SaturationEvaluation {
  score: number;                        // 0-100
  isSaturated: boolean;                 // score >= 80
  nextQuestions: string[];              // 建议提问列表
  matchedDimensions: string[];          // 已匹配的维度
  missingDimensions: string[];          // 缺失的维度
}

/**
 * 话题漂移检测
 */
export interface TopicDrift {
  isChanged: boolean;
  newTopic?: string;
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add types/interview-v2.ts
git commit -m "feat(interview): add dynamic interview type definitions"
```

---

## Task 2: Create Blueprint Database Table

**Files:**
- Modify: `db/schema.ts`

**Step 1: Add topic_blueprints table to schema**

Add after the `courseSessions` table definition:

```typescript
// ============================================
// Topic Blueprints (动态评分蓝图)
// ============================================

export const topicBlueprints = pgTable(
  "topic_blueprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    topicHash: text("topic_hash").notNull().unique(),

    // 核心维度 (JSONB)
    coreDimensions: jsonb("core_dimensions").$type<Array<{
      name: string;
      keywords: string[];
      weight: number;
      suggestion: string;
    }>>().notNull(),

    // 元数据
    modelUsed: text("model_used").notNull().default("gemini-3-flash"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    topicHashIdx: index("topic_blueprints_topic_hash_idx").on(table.topicHash),
  }),
);

export type TopicBlueprint = typeof topicBlueprints.$inferSelect;
export type NewTopicBlueprint = typeof topicBlueprints.$inferInsert;
```

**Step 2: Add relation**

In the relations section, add:

```typescript
export const topicBlueprintsRelations = relations(topicBlueprints, ({}) => ({}));
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Push schema to database**

Run: `bun run db:push`
Expected: SUCCESS (new table created)

**Step 5: Commit**

```bash
git add db/schema.ts
git commit -m "feat(db): add topic_blueprints table for dynamic evaluation"
```

---

## Task 3: Create Blueprint Generation Service

**Files:**
- Create: `lib/ai/blueprint/generator.ts`
- Create: `lib/ai/blueprint/index.ts`
- Create: `lib/ai/blueprint/cache.ts`

**Step 1: Create the generator**

```typescript
// lib/ai/blueprint/generator.ts

import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { topicBlueprints } from "@/db/schema";
import { aiProvider } from "../core";

const BlueprintSchema = z.object({
  coreDimensions: z.array(z.object({
    name: z.string().describe("维度名称，如'编程基础'、'学习目标'"),
    keywords: z.array(z.string()).describe("匹配关键词，用于匹配用户提到的信息"),
    weight: z.number().min(0).max(100).describe("权重，所有维度权重之和应为100"),
    suggestion: z.string().describe("建议提问方向"),
  })).min(3).max(5).describe("3-5个核心评估维度"),
});

/**
 * 生成主题哈希（简单但有效）
 */
function hashTopic(topic: string): string {
  // 标准化：小写、去空格、取前50字符
  const normalized = topic.toLowerCase().trim().slice(0, 50);
  // 简单哈希
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 生成主题评分蓝图
 * 使用轻量模型异步生成
 */
export async function generateTopicBlueprint(topic: string): Promise<string> {
  const topicHash = hashTopic(topic);

  // 检查缓存
  const existing = await db.query.topicBlueprints.findFirst({
    where: (t, { eq }) => eq(t.topicHash, topicHash),
  });

  if (existing) {
    return existing.id;
  }

  // 生成新蓝图
  const model = aiProvider.chatModel;

  const result = await generateObject({
    model,
    schema: BlueprintSchema,
    prompt: `我要为一个想学《${topic}》的用户做访谈。请生成一个打分权重的蓝图。

要求：
1. 列出 3-5 个核心评估维度
2. 每个维度有权重（总和100）
3. 提供关键词用于匹配用户提到的信息
4. 提供建议提问方向

注意：
- 维度应该是该主题特有的，不是通用的
- 例如学做菜需要"设备"、"口味"维度，学编程需要"语言基础"、"目标"维度`,
  });

  // 存储蓝图
  const [blueprint] = await db.insert(topicBlueprints).values({
    topic,
    topicHash,
    coreDimensions: result.object.coreDimensions,
    modelUsed: "gemini-3-flash",
  }).returning();

  return blueprint.id;
}

/**
 * 触发异步蓝图生成（不等待结果）
 */
export function triggerBlueprintGeneration(topic: string): void {
  generateTopicBlueprint(topic).catch((error) => {
    console.error("[Blueprint] Failed to generate:", error);
  });
}
```

**Step 2: Create cache module**

```typescript
// lib/ai/blueprint/cache.ts

import { db } from "@/db";
import { topicBlueprints } from "@/db/schema";
import { hashTopic } from "./generator";
import type { BlueprintDimension, TopicBlueprint } from "@/types/interview-v2";

// 内存缓存（进程级）
const cache = new Map<string, TopicBlueprint>();

/**
 * 获取蓝图（优先内存缓存，其次数据库）
 */
export async function getBlueprint(topic: string): Promise<TopicBlueprint | null> {
  const hash = hashTopic(topic);

  // 1. 检查内存缓存
  const cached = cache.get(hash);
  if (cached) {
    return cached;
  }

  // 2. 查询数据库
  const dbBlueprint = await db.query.topicBlueprints.findFirst({
    where: (t, { eq }) => eq(t.topicHash, hash),
  });

  if (!dbBlueprint) {
    return null;
  }

  // 3. 转换并缓存
  const blueprint: TopicBlueprint = {
    id: dbBlueprint.id,
    topic: dbBlueprint.topic,
    topicHash: dbBlueprint.topicHash,
    coreDimensions: dbBlueprint.coreDimensions as BlueprintDimension[],
    generatedAt: dbBlueprint.createdAt.toISOString(),
    modelUsed: dbBlueprint.modelUsed,
  };

  cache.set(hash, blueprint);
  return blueprint;
}

/**
 * 清除缓存
 */
export function clearBlueprintCache(topic?: string): void {
  if (topic) {
    const hash = hashTopic(topic);
    cache.delete(hash);
  } else {
    cache.clear();
  }
}
```

**Step 3: Create index**

```typescript
// lib/ai/blueprint/index.ts

export { generateTopicBlueprint, triggerBlueprintGeneration } from "./generator";
export { getBlueprint, clearBlueprintCache } from "./cache";
```

**Step 4: Fix generator hash function export**

```typescript
// lib/ai/blueprint/generator.ts - 更新 hashTopic 函数，添加 export

export function hashTopic(topic: string): string {
  // ... 同上
}
```

**Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/ai/blueprint/
git commit -m "feat(ai): add blueprint generation service for dynamic evaluation"
```

---

## Task 4: Create Local Saturation Evaluator

**Files:**
- Create: `lib/ai/evaluation/saturation.ts`

**Step 1: Create the evaluator**

```typescript
// lib/ai/evaluation/saturation.ts

import type { ExtractedFact, SaturationEvaluation, TopicBlueprint } from "@/types/interview-v2";
import { getBlueprint } from "../blueprint";

/**
 * 默认蓝图（当主题蓝图尚未生成时使用）
 */
const DEFAULT_BLUEPRINT: TopicBlueprint = {
  id: "default",
  topic: "通用",
  topicHash: "default",
  coreDimensions: [
    {
      name: "背景",
      keywords: ["背景", "基础", "经验", "了解", "学过"],
      weight: 30,
      suggestion: "询问用户的相关背景或经验",
    },
    {
      name: "目标",
      keywords: ["目标", "目的", "想要", "希望", "为了"],
      weight: 35,
      suggestion: "询问用户的学习目标或期望成果",
    },
    {
      name: "约束",
      keywords: ["时间", "预算", "设备", "环境", "限制"],
      weight: 20,
      suggestion: "询问用户的时间安排或资源限制",
    },
    {
      name: "偏好",
      keywords: ["偏好", "喜欢", "习惯", "风格", "方式"],
      weight: 15,
      suggestion: "询问用户的学习偏好或风格",
    },
  ],
  generatedAt: new Date().toISOString(),
  modelUsed: "default",
};

/**
 * 本地极速评估饱和度
 * 0ms 延迟，0 API 成本
 */
export async function evaluateSaturation(
  topic: string,
  extractedFacts: ExtractedFact[],
): Promise<SaturationEvaluation> {
  // 获取蓝图
  let blueprint = await getBlueprint(topic);

  // 如果蓝图不存在，使用默认蓝图
  if (!blueprint) {
    blueprint = DEFAULT_BLUEPRINT;
  }

  return evaluateSaturationLocally(blueprint, extractedFacts);
}

/**
 * 纯本地评估（已知蓝图）
 */
export function evaluateSaturationLocally(
  blueprint: TopicBlueprint,
  extractedFacts: ExtractedFact[],
): SaturationEvaluation {
  let score = 0;
  const matchedDimensions: string[] = [];
  const missingDimensions: string[] = [];
  const nextQuestions: string[] = [];

  for (const dim of blueprint.coreDimensions) {
    // 检查是否有事实匹配该维度
    const isMatched = extractedFacts.some((fact) => {
      // 维度名称精确匹配
      if (fact.dimension === dim.name) {
        return true;
      }
      // 关键词匹配
      return dim.keywords.some(
        (kw) =>
          fact.dimension.includes(kw) ||
          fact.dimension.toLowerCase().includes(kw.toLowerCase()),
      );
    });

    if (isMatched) {
      score += dim.weight;
      matchedDimensions.push(dim.name);
    } else {
      missingDimensions.push(dim.name);
      nextQuestions.push(dim.suggestion);
    }
  }

  return {
    score,
    isSaturated: score >= 80,
    nextQuestions,
    matchedDimensions,
    missingDimensions,
  };
}
```

**Step 2: Create index**

```typescript
// lib/ai/evaluation/index.ts

export { evaluateSaturation, evaluateSaturationLocally } from "./saturation";
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/ai/evaluation/
git commit -m "feat(ai): add local saturation evaluator"
```

---

## Task 5: Create commitAndEvaluate Tool

**Files:**
- Create: `lib/ai/tools/interview-v2/commit-and-evaluate.ts`
- Create: `lib/ai/tools/interview-v2/index.ts`

**Step 1: Create the tool**

```typescript
// lib/ai/tools/interview-v2/commit-and-evaluate.ts

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { ExtractedFact, TopicBlueprint } from "@/types/interview-v2";
import { getBlueprint, triggerBlueprintGeneration } from "@/lib/ai/blueprint";
import { evaluateSaturation } from "@/lib/ai/evaluation";

const FactSchema = z.object({
  dimension: z.string().describe("提取出的信息维度，如'编程基础'、'学习目标'"),
  value: z.union([z.string(), z.number(), z.boolean()]),
  type: z.enum(["string", "number", "boolean"]),
});

const TopicDriftSchema = z.object({
  isChanged: z.boolean().describe("用户是否改变了想学的主题？"),
  newTopic: z.string().optional().describe("如果改变了，新的主题是什么？"),
});

/**
 * 创建 commitAndEvaluate 工具
 *
 * 动态注入已有维度，实现自注意力对齐
 */
export function createCommitAndEvaluateTool(
  courseProfileId: string,
  existingDimensions: string[],
) {
  const dimensionHint =
    existingDimensions.length > 0
      ? `⚠️ 极端重要：当前已存在的维度有 [${existingDimensions.join(", ")}]。
如果用户的新信息属于这些已有维度，你必须【严格使用上述完全一致的字符串】覆盖它。
只有当信息完全不属于已有维度时，你才可以创造一个简短的新维度名词。`
      : "这是首次提取，你可以自由定义维度名称，但要简洁明确。";

  return tool({
    description: `从用户的最新回复中提取事实并提交。系统会自动评估当前的信息饱和度，并指导你下一步该问什么。

${dimensionHint}`,
    inputSchema: z.object({
      newFacts: z.array(FactSchema).describe("本次对话提取到的新事实"),
      topicDrift: TopicDriftSchema.describe("话题漂移检测"),
    }),
    execute: async ({ newFacts, topicDrift }) => {
      try {
        // 获取当前课程状态
        const [course] = await db
          .select()
          .from(courseSessions)
          .where(eq(courseSessions.id, courseProfileId))
          .limit(1);

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        // 解析当前状态
        const currentProfile = (course.interviewProfile as Record<string, unknown>) || {};
        const currentTopic = (currentProfile.currentTopic as string) || course.title || "";
        let extractedFacts = (currentProfile.extractedFacts as ExtractedFact[]) || [];

        // 处理话题漂移
        if (topicDrift.isChanged && topicDrift.newTopic) {
          // 清空旧事实
          extractedFacts = [];
          // 更新主题
          currentProfile.currentTopic = topicDrift.newTopic;
          // 触发异步蓝图生成
          triggerBlueprintGeneration(topicDrift.newTopic);

          console.log("[Interview] Topic drift detected:", topicDrift.newTopic);
        }

        // 合并新事实 (Upsert)
        const factMap = new Map(extractedFacts.map((f) => [f.dimension, f]));
        const now = new Date().toISOString();

        for (const fact of newFacts) {
          factMap.set(fact.dimension, {
            ...fact,
            confidence: 0.9,
            extractedAt: now,
          });
        }

        extractedFacts = Array.from(factMap.values());

        // 评估饱和度
        const activeTopic = topicDrift.newTopic || currentTopic;
        const evaluation = await evaluateSaturation(activeTopic, extractedFacts);

        // 更新数据库
        const updatedProfile = {
          ...currentProfile,
          currentTopic: activeTopic,
          extractedFacts,
          saturationScore: evaluation.score,
          nextHighValueDimensions: evaluation.missingDimensions,
        };

        await db
          .update(courseSessions)
          .set({
            title: activeTopic,
            interviewProfile: updatedProfile,
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseProfileId));

        return {
          success: true,
          currentSaturation: evaluation.score,
          isReadyForOutline: evaluation.isSaturated,
          suggestedNextQuestions: evaluation.nextQuestions,
          matchedDimensions: evaluation.matchedDimensions,
          missingDimensions: evaluation.missingDimensions,
        };
      } catch (error) {
        console.error("[commitAndEvaluate]", error);
        return { success: false, error: "评估失败" };
      }
    },
  });
}
```

**Step 2: Create generateOutline tool**

```typescript
// lib/ai/tools/interview-v2/generate-outline.ts

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";

const OutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional().describe("课程描述"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number().describe("预计学习时长（分钟）"),
  modules: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        chapters: z.array(z.string()),
      }),
    )
    .min(1)
    .describe("课程模块列表"),
});

/**
 * 创建 generateOutline 工具
 */
export function createGenerateOutlineTool(courseProfileId: string) {
  return tool({
    description: "生成课程大纲。当 commitAndEvaluate 返回 isReadyForOutline: true 时调用。",
    inputSchema: OutlineSchema,
    execute: async (outline) => {
      try {
        const chapters = outline.modules.map((m, i) => ({
          title: m.title,
          description: m.description,
          topics: m.chapters,
          order: i,
        }));

        const outlineData = {
          title: outline.title,
          description: outline.description,
          estimatedMinutes: outline.estimatedMinutes,
          chapters,
        };

        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: outline.estimatedMinutes,
            outlineData,
            interviewStatus: "completed",
            status: "outline_confirmed",
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseProfileId));

        return {
          success: true,
          outline: outlineData,
          message: "大纲已生成",
        };
      } catch (error) {
        console.error("[generateOutline]", error);
        return { success: false, error: "生成失败" };
      }
    },
  });
}
```

**Step 3: Create index with factory function**

```typescript
// lib/ai/tools/interview-v2/index.ts

import { createCommitAndEvaluateTool } from "./commit-and-evaluate";
import { createGenerateOutlineTool } from "./generate-outline";

export { createCommitAndEvaluateTool } from "./commit-and-evaluate";
export { createGenerateOutlineTool } from "./generate-outline";

/**
 * 创建动态访谈工具集
 *
 * @param courseProfileId - 课程 ID
 * @param existingDimensions - 已有的维度列表（用于动态注入）
 */
export function createDynamicInterviewTools(
  courseProfileId: string,
  existingDimensions: string[] = [],
) {
  return {
    commitAndEvaluate: createCommitAndEvaluateTool(courseProfileId, existingDimensions),
    generateOutline: createGenerateOutlineTool(courseProfileId),
  };
}
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/ai/tools/interview-v2/
git commit -m "feat(ai): add dynamic interview tools (commitAndEvaluate, generateOutline)"
```

---

## Task 6: Create Dynamic Interview Agent

**Files:**
- Create: `lib/ai/agents/interview-v2.ts`

**Step 1: Create the agent**

```typescript
// lib/ai/agents/interview-v2.ts

import { stepCountIs, ToolLoopAgent } from "ai";
import { aiProvider } from "../core";
import { createDynamicInterviewTools } from "../tools/interview-v2";

const INTERVIEW_MAX_STEPS = 15;

const SYSTEM_PROMPT = `你是 NexusNote 的高级学术向导。你的目标是深入了解用户，以便为他们生成高度定制化的课程大纲。

## 你的工作方式 (Entropy-Driven Flow)

1. **自然对话**：像资深导师一样与用户聊天，不要机械连问。每次只问一个核心问题。

2. **提取与提交**：每次用户回复后，调用 \`commitAndEvaluate\` 将你发现的客观事实（Facts）提交给系统。
   - 提取用户的背景、目标、约束、偏好等信息
   - 每次可以提取 1-3 个事实
   - 事实的 dimension 要简洁明确

3. **听从系统指引**：工具返回结果后，查看：
   - \`currentSaturation\`（饱和度 0-100）
   - \`suggestedNextQuestions\`（建议提问方向）
   - 顺着系统的建议方向，用你自然的口吻向用户提问

4. **从容应对跑题**：如果用户突然想学别的东西，在调用工具时将 \`topicDrift.isChanged\` 设为 true，并提供 \`newTopic\`。系统会自动重置，顺着他们的新兴趣聊。

## 终结条件

当工具返回 \`isReadyForOutline: true\` 时（通常饱和度 ≥ 80%），说明信息已经足够。
此时，**停止提问**，直接调用 \`generateOutline\` 工具为用户生成大纲，并热情地结束访谈。

## 重要提醒

- 每次回复必须先输出文字内容，再调用工具
- 绝不能只调用工具不输出文字
- 要像朋友聊天一样自然，不要审问`;

export interface DynamicInterviewOptions {
  courseProfileId: string;
  existingDimensions?: string[];
}

/**
 * 创建动态访谈 Agent
 */
export function createDynamicInterviewAgent(options: DynamicInterviewOptions) {
  if (!options.courseProfileId) {
    throw new Error("Dynamic Interview agent requires courseProfileId");
  }

  const tools = createDynamicInterviewTools(
    options.courseProfileId,
    options.existingDimensions || [],
  );

  return new ToolLoopAgent({
    id: "nexusnote-dynamic-interviewer",
    model: aiProvider.proModel,
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(INTERVIEW_MAX_STEPS),
  });
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/ai/agents/interview-v2.ts
git commit -m "feat(ai): add dynamic interview agent with entropy-driven flow"
```

---

## Task 7: Update getAgent Factory

**Files:**
- Modify: `lib/ai/agents/index.ts`

**Step 1: Add DYNAMIC_INTERVIEW intent**

```typescript
// lib/ai/agents/index.ts

import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createCourseAgent } from "./course";
import { createInterviewAgent, type InterviewOptions } from "./interview";
import { createDynamicInterviewAgent, type DynamicInterviewOptions } from "./interview-v2";
import { createSkillsAgent, type SkillsAgentOptions } from "./skills";

// ============================================
// Types
// ============================================

export type AgentIntent =
  | "CHAT"
  | "INTERVIEW"
  | "DYNAMIC_INTERVIEW"  // 新增
  | "COURSE"
  | "SKILLS"
  | "EDITOR"
  | "SEARCH";

export type { PersonalizationOptions, InterviewOptions, SkillsAgentOptions, DynamicInterviewOptions };

// ============================================
// Factory
// ============================================

export function getAgent(
  intent: AgentIntent,
  options?: PersonalizationOptions | InterviewOptions | SkillsAgentOptions | DynamicInterviewOptions,
) {
  switch (intent) {
    case "DYNAMIC_INTERVIEW": {
      return createDynamicInterviewAgent(options as DynamicInterviewOptions);
    }
    case "INTERVIEW": {
      return createInterviewAgent(options as InterviewOptions);
    }
    case "COURSE":
      return createCourseAgent(options as PersonalizationOptions | undefined);
    case "SKILLS": {
      const personalization = options as PersonalizationOptions | undefined;
      const userId = (options as Record<string, unknown>)?.userId as string | undefined;
      if (!userId) {
        return createChatAgent(personalization);
      }
      return createSkillsAgent({
        ...personalization,
        userId,
      });
    }
    default:
      return createChatAgent(options as PersonalizationOptions | undefined);
  }
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/ai/agents/index.ts
git commit -m "feat(ai): add DYNAMIC_INTERVIEW intent to agent factory"
```

---

## Task 8: Create Interview V2 API Route

**Files:**
- Create: `app/api/interview-v2/route.ts`

**Step 1: Create the API route**

```typescript
// app/api/interview-v2/route.ts

/**
 * Dynamic Interview API v2
 *
 * 基于信息熵的连续状态评估架构
 */

import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { conversations, courseSessions, db } from "@/db";
import type { ExtractedFact } from "@/types/interview-v2";
import { getAgent } from "@/lib/ai";
import { createNexusNoteStreamResponse } from "@/lib/ai/streaming";
import { triggerBlueprintGeneration } from "@/lib/ai/blueprint";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new APIError("无效的 JSON", 400, "INVALID_JSON");
    }

    // 简化验证
    const { messages, sessionId, courseId: inputCourseId } = body as {
      messages: UIMessage[];
      sessionId?: string;
      courseId?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      throw new APIError("缺少 messages", 400, "INVALID_REQUEST");
    }

    // 获取或创建课程
    let activeCourseId = inputCourseId;

    if (activeCourseId) {
      const existingCourse = await db.query.courseSessions.findFirst({
        where: (c, { eq, and }) => and(eq(c.id, activeCourseId!), eq(c.userId, userId)),
      });
      if (!existingCourse) {
        activeCourseId = undefined;
      }
    }

    if (!activeCourseId) {
      // 创建新课程
      const firstUserMessage = messages.find((m) => m.role === "user");
      let topic = "学习新知识";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          topic = textPart.text.slice(0, 200);
        }
      }

      const [newCourse] = await db
        .insert(courseSessions)
        .values({
          userId,
          title: topic,
          interviewProfile: {
            currentTopic: topic,
            extractedFacts: [],
            saturationScore: 0,
            nextHighValueDimensions: [],
          },
          interviewStatus: "interviewing",
          status: "idle",
        })
        .returning();

      activeCourseId = newCourse.id;

      // 触发异步蓝图生成
      triggerBlueprintGeneration(topic);

      console.log("[InterviewV2] Created course:", activeCourseId);
    }

    // 获取已有的维度（用于动态注入）
    const [course] = await db
      .select()
      .from(courseSessions)
      .where(eq(courseSessions.id, activeCourseId))
      .limit(1);

    const existingDimensions = (
      (course?.interviewProfile as Record<string, unknown>)?.extractedFacts as ExtractedFact[]
    )?.map((f) => f.dimension) || [];

    // 创建 Agent
    const agent = getAgent("DYNAMIC_INTERVIEW", {
      courseProfileId: activeCourseId,
      existingDimensions,
    });

    const response = await createNexusNoteStreamResponse(agent, messages);

    const durationMs = Date.now() - startTime;
    console.log("[InterviewV2] Request completed in", durationMs, "ms");

    if (sessionId) {
      response.headers.set("X-Session-Id", sessionId);
    }
    if (activeCourseId) {
      response.headers.set("X-Course-Id", activeCourseId);
    }

    return response;
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "v2",
    features: ["dynamic-facts", "entropy-driven", "topic-drift", "zero-latency-evaluation"],
    timestamp: new Date().toISOString(),
  });
}
```

**Step 2: Add missing import**

The file needs the `eq` import from db. Add it:

```typescript
import { conversations, courseSessions, db, eq } from "@/db";
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/api/interview-v2/route.ts
git commit -m "feat(api): add interview-v2 endpoint with dynamic evaluation"
```

---

## Task 9: Final Verification

**Step 1: Run full typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 2: Run lint**

Run: `bun run lint`
Expected: PASS (or minor warnings)

**Step 3: Verify new files exist**

Run: `ls -la types/interview-v2.ts lib/ai/blueprint/ lib/ai/evaluation/ lib/ai/tools/interview-v2/ lib/ai/agents/interview-v2.ts app/api/interview-v2/`
Expected: All files exist

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(interview): complete dynamic interview entropy-driven system

Architecture:
- EAV model for dynamic fact extraction
- Async blueprint generation + local rule evaluation
- Native Topic Drift support
- Zero-latency saturation scoring

Components:
- types/interview-v2.ts: Type definitions
- lib/ai/blueprint/: Blueprint generation & caching
- lib/ai/evaluation/: Local saturation evaluator
- lib/ai/tools/interview-v2/: commitAndEvaluate & generateOutline tools
- lib/ai/agents/interview-v2.ts: Dynamic interview agent
- app/api/interview-v2/: API endpoint"
```

---

## Rollback Plan

If issues arise, the old interview system remains intact at:
- `lib/ai/tools/interview/` - Original tools
- `lib/ai/agents/interview.ts` - Original agent
- `app/api/interview/` - Original API

The new system runs in parallel at:
- `/api/interview-v2` endpoint

---

## Testing Checklist

After deployment:

- [ ] Create new interview session → verify blueprint generation triggers
- [ ] Chat with agent → verify facts extracted and stored
- [ ] Check saturation score increases with more facts
- [ ] Test Topic Drift → change topic mid-conversation
- [ ] Verify outline generation when saturation ≥ 80%
- [ ] Check database records in `topic_blueprints` and `course_sessions`

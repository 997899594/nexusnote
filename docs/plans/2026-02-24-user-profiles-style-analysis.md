# User Profiles Refactoring & Style Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 精简 `user_profiles` 表，删除冗余字段，添加风格分析功能（AI 推断 + 用户手动设置结合）

**Architecture:**
1. 删除 `user_profiles` 冗余字段（learningGoals, knowledgeAreas, assessmentHistory, currentLevel, totalStudyMinutes, profileEmbedding）
2. 添加风格分析字段（语言复杂度、沟通风格、Big Five 人格特质）
3. 保留手动学习偏好字段（learningStyle - 用户主动设置）
4. 创建风格分析 Agent 和 API
5. 创建隐私设置表

**Tech Stack:** Drizzle ORM, PostgreSQL, Vercel AI SDK v6, Next.js 16, React 19

---

## Task 1: 删除 user_profiles 冗余字段

**Files:**
- Modify: `db/schema.ts:48-70`

**Step 1: 修改 schema 定义**

在 `db/schema.ts` 中，将 `userProfiles` 表定义修改为：

```typescript
// User profile - 风格分析 + 学习偏好
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // ========== 手动设置的学习偏好 ==========
    // 用户主动设置，非 AI 推断
    learningStyle: jsonb("learning_style"),  // { preferredFormat, pace }

    // ========== 风格分析字段（AI 推断）==========
    // 语言复杂度 (0-1)
    vocabularyComplexity: jsonb("vocabulary_complexity").$type<{ value: number; confidence: number; samples: number }>(),
    sentenceComplexity: jsonb("sentence_complexity").$type<{ value: number; confidence: number; samples: number }>(),
    abstractionLevel: jsonb("abstraction_level").$type<{ value: number; confidence: number; samples: number }>(),

    // 沟通风格 (0-1)
    directness: jsonb("directness").$type<{ value: number; confidence: number; samples: number }>(),
    conciseness: jsonb("conciseness").$type<{ value: number; confidence: number; samples: number }>(),
    formality: jsonb("formality").$type<{ value: number; confidence: number; samples: number }>(),
    emotionalIntensity: jsonb("emotional_intensity").$type<{ value: number; confidence: number; samples: number }>(),

    // Big Five 特质 (0-1) - 敏感数据，需用户同意
    openness: jsonb("openness").$type<{ value: number; confidence: number; samples: number }>(),
    conscientiousness: jsonb("conscientiousness").$type<{ value: number; confidence: number; samples: number }>(),
    extraversion: jsonb("extraversion").$type<{ value: number; confidence: number; samples: number }>(),
    agreeableness: jsonb("agreeableness").$type<{ value: number; confidence: number; samples: number }>(),
    neuroticism: jsonb("neuroticism").$type<{ value: number; confidence: number; samples: number }>(),

    // 分析元数据
    totalMessagesAnalyzed: integer("total_messages_analyzed").notNull().default(0),
    totalConversationsAnalyzed: integer("total_conversations_analyzed").notNull().default(0),
    lastAnalyzedAt: timestamp("last_analyzed_at"),

    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_profiles_user_id_idx").on(table.userId),
  }),
);
```

**Step 2: 生成并运行迁移**

```bash
# 生成迁移
npx drizzle-kit generate

# 检查生成的 SQL，确认 DROP COLUMN 正确
cat drizzle/*.sql

# 运行迁移
npx drizzle-kit migrate
```

**Step 3: 更新 TypeScript 类型**

确认 `db/schema.ts` 底部的类型导出正确更新：

```typescript
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
```

**Step 4: Commit**

```bash
git add db/schema.ts drizzle/
git commit -m "refactor(user_profiles): remove redundant fields, add style analysis fields"
```

---

## Task 2: 重构 lib/profile.ts 服务层

**Files:**
- Modify: `lib/profile.ts`
- Test: 手动测试现有功能

**Step 1: 删除冗余接口和方法**

删除以下不再使用的接口和代码：

```typescript
// 删除这些接口
- export interface LearningGoals { ... }
- export interface KnowledgeAreas { ... }
- export interface AssessmentHistory { ... }
- export type CurrentLevel = ...

// 删除 CreateProfileInput 和 UpdateProfileInput 中的冗余字段
```

**Step 2: 更新 profile.ts**

保留 `getOrCreate`，更新初始化数据：

```typescript
export async function getOrCreate(userId: string) {
  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (existing) return existing;

  const [newProfile] = await db
    .insert(userProfiles)
    .values({
      userId,
      learningStyle: { preferredFormat: "mixed", pace: "moderate" },
      vocabularyComplexity: { value: 0.5, confidence: 0, samples: 0 },
      sentenceComplexity: { value: 0.5, confidence: 0, samples: 0 },
      abstractionLevel: { value: 0.5, confidence: 0, samples: 0 },
      directness: { value: 0.5, confidence: 0, samples: 0 },
      conciseness: { value: 0.5, confidence: 0, samples: 0 },
      formality: { value: 0.5, confidence: 0, samples: 0 },
      emotionalIntensity: { value: 0.5, confidence: 0, samples: 0 },
      openness: { value: 0.5, confidence: 0, samples: 0 },
      conscientiousness: { value: 0.5, confidence: 0, samples: 0 },
      extraversion: { value: 0.5, confidence: 0, samples: 0 },
      agreeableness: { value: 0.5, confidence: 0, samples: 0 },
      neuroticism: { value: 0.5, confidence: 0, samples: 0 },
      totalMessagesAnalyzed: 0,
      totalConversationsAnalyzed: 0,
    })
    .returning();

  return newProfile;
}
```

**Step 3: 删除 profileEmbedding 相关方法**

删除 `getProfileChunk()`, `generateProfileEmbedding()`, `updateProfileEmbedding()` - 不再需要

**Step 4: Commit**

```bash
git add lib/profile.ts
git commit -m "refactor(profile): remove redundant methods, update for new schema"
```

---

## Task 3: 创建风格分析服务层

**Files:**
- Create: `lib/style/analysis.ts`
- Create: `lib/style/ema.ts`

**Step 1: 创建 EMA 更新算法**

```typescript
// lib/style/ema.ts

/**
 * EMA (Exponential Moving Average) 更新算法
 * 用于平滑更新风格分析结果
 */

export interface EMAValue {
  value: number;        // 当前值 (0-1)
  confidence: number;   // 置信度 (0-1)
  samples: number;      // 样本数量
}

const DEFAULT_ALPHA = 0.3;  // 平滑因子，越小越平滑

/**
 * 更新 EMA 值
 * @param current 当前 EMA 值
 * @param newValue 新观察值 (0-1)
 * @param alpha 平滑因子，默认 0.3
 */
export function updateEMA(
  current: EMAValue,
  newValue: number,
  alpha: number = DEFAULT_ALPHA
): EMAValue {
  const newSamples = current.samples + 1;

  // EMA 公式: newEMA = alpha * newValue + (1 - alpha) * oldEMA
  const newEMA = alpha * newValue + (1 - alpha) * current.value;

  // 置信度随样本量增加，但上限为 0.95
  const newConfidence = Math.min(0.95, current.confidence + (1 - current.confidence) * 0.1);

  return {
    value: newEMA,
    confidence: newConfidence,
    samples: newSamples,
  };
}

/**
 * 批量更新多个 EMA 值
 */
export function updateEMABatch(
  current: Record<string, EMAValue>,
  newValues: Record<string, number>,
  alpha: number = DEFAULT_ALPHA
): Record<string, EMAValue> {
  const result = { ...current };

  for (const [key, newValue] of Object.entries(newValues)) {
    if (key in result) {
      result[key] = updateEMA(result[key], newValue, alpha);
    } else {
      result[key] = { value: newValue, confidence: 0.1, samples: 1 };
    }
  }

  return result;
}
```

**Step 2: 创建风格分析服务**

```typescript
// lib/style/analysis.ts

/**
 * Style Analysis Service
 *
 * 分析用户对话风格，使用 EMA 算法平滑更新
 */

import { db, conversations, userProfiles, eq } from "@/db";
import { updateEMA, type EMAValue } from "./style/ema";

/**
 * 风格分析结果
 */
export interface StyleAnalysisResult {
  // 语言复杂度
  vocabularyComplexity: number;
  sentenceComplexity: number;
  abstractionLevel: number;

  // 沟通风格
  directness: number;
  conciseness: number;
  formality: number;
  emotionalIntensity: number;

  // Big Five（可选，需用户同意）
  openness?: number;
  conscientiousness?: number;
  extraversion?: number;
  agreeableness?: number;
  neuroticism?: number;
}

/**
 * 分析单条对话的风格
 * TODO: 实际实现需要调用 AI 模型分析
 */
async function analyzeConversationStyle(messages: any[]): Promise<StyleAnalysisResult> {
  // 提取用户消息
  const userMessages = messages.filter((m: any) => m.role === "user");

  if (userMessages.length === 0) {
    throw new Error("No user messages to analyze");
  }

  // TODO: 调用 AI 分析风格
  // 这里先用简单的规则作为 placeholder
  const totalText = userMessages.map((m: any) => m.content || "").join(" ");
  const wordCount = totalText.split(/\s+/).length;
  const avgWordLength = wordCount > 0 ? totalText.length / wordCount : 0;

  return {
    vocabularyComplexity: Math.min(1, avgWordLength / 8),
    sentenceComplexity: 0.5,
    abstractionLevel: 0.5,
    directness: 0.5,
    conciseness: 0.5,
    formality: 0.5,
    emotionalIntensity: 0.5,
  };
}

/**
 * 更新用户风格画像
 */
export async function updateUserStyleProfile(
  userId: string,
  conversationId: string
): Promise<void> {
  // 获取对话
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation || conversation.userId !== userId) {
    throw new Error("Conversation not found or access denied");
  }

  // 获取当前用户画像
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    throw new Error("User profile not found");
  }

  // 分析当前对话风格
  const analysis = await analyzeConversationStyle(conversation.messages as any[]);

  // 使用 EMA 更新各维度
  const updates: Partial<typeof userProfiles.$inferInsert> = {
    vocabularyComplexity: updateEMA(
      profile.vocabularyComplexity as EMAValue,
      analysis.vocabularyComplexity
    ),
    sentenceComplexity: updateEMA(
      profile.sentenceComplexity as EMAValue,
      analysis.sentenceComplexity
    ),
    abstractionLevel: updateEMA(
      profile.abstractionLevel as EMAValue,
      analysis.abstractionLevel
    ),
    directness: updateEMA(
      profile.directness as EMAValue,
      analysis.directness
    ),
    conciseness: updateEMA(
      profile.conciseness as EMAValue,
      analysis.conciseness
    ),
    formality: updateEMA(
      profile.formality as EMAValue,
      analysis.formality
    ),
    emotionalIntensity: updateEMA(
      profile.emotionalIntensity as EMAValue,
      analysis.emotionalIntensity
    ),
    totalMessagesAnalyzed: (profile.totalMessagesAnalyzed || 0) + 1,
    totalConversationsAnalyzed: (profile.totalConversationsAnalyzed || 0) + 1,
    lastAnalyzedAt: new Date(),
    updatedAt: new Date(),
  };

  // 更新数据库
  await db
    .update(userProfiles)
    .set(updates)
    .where(eq(userProfiles.userId, userId));
}

/**
 * 获取用户风格画像
 */
export async function getUserStyleProfile(userId: string) {
  return await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });
}
```

**Step 3: Commit**

```bash
git add lib/style/
git commit -m "feat(style): add EMA algorithm and style analysis service"
```

---

## Task 4: 创建风格分析 Agent

**Files:**
- Modify: `lib/ai/agents/index.ts`
- Create: `lib/ai/tools/style/analysis.ts`

**Step 1: 创建风格分析工具**

```typescript
// lib/ai/tools/style/analysis.ts

import { tool } from "ai";
import { z } from "zod";

export const AnalyzeStyleToolSchema = z.object({
  conversationId: z.string().describe("对话 ID"),
  includeBigFive: z.boolean().optional().default(false).describe("是否分析 Big Five 人格特质"),
});

export type AnalyzeStyleToolInput = z.infer<typeof AnalyzeStyleToolSchema>;

export const analyzeStyleTool = tool({
  description: "分析用户对话风格，更新用户风格画像",
  inputSchema: AnalyzeStyleToolSchema,
  execute: async ({ conversationId, includeBigFive }) => {
    try {
      const { updateUserStyleProfile } = await import("@/lib/style/analysis");

      // TODO: 从上下文获取 userId
      const userId = "current-user-id"; // 这需要从 session 获取

      await updateUserStyleProfile(userId, conversationId);

      return {
        success: true,
        message: "风格分析完成",
      };
    } catch (error) {
      console.error("[Tool] analyzeStyle error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
```

**Step 2: 添加 STYLE Agent**

在 `lib/ai/agents/index.ts` 中添加：

```typescript
import { analyzeStyleTool } from "../tools/style/analysis";

const styleTools = {
  analyzeStyle: analyzeStyleTool,
} as ToolSet;

const INSTRUCTIONS = {
  // ... 现有指令 ...

  style: `你是 NexusNote 的风格分析专家。

你的任务是分析用户的对话风格，提取以下维度：

语言复杂度：
- vocabularyComplexity: 词汇丰富度 (0-1)
- sentenceComplexity: 句法复杂度 (0-1)
- abstractionLevel: 抽象程度 (0-1)

沟通风格：
- directness: 直接 vs 委婉 (0-1)
- conciseness: 简洁 vs 详细 (0-1)
- formality: 正式度 (0-1)
- emotionalIntensity: 情感强度 (0-1)

使用 analyzeStyle 工具来分析并保存风格数据。`,
} as const;

export function getAgent(
  intent: "CHAT" | "INTERVIEW" | "COURSE" | "EDITOR" | "SEARCH" | "SKILLS" | "STYLE",
  _sessionId?: string,
) {
  switch (intent) {
    // ... 现有 case ...
    case "STYLE":
      return createAgent("nexusnote-style", aiProvider.proModel, INSTRUCTIONS.style, styleTools);
    // ...
  }
}
```

**Step 3: Commit**

```bash
git add lib/ai/tools/style/ lib/ai/agents/index.ts
git commit -m "feat(ai): add style analysis agent and tool"
```

---

## Task 5: 创建风格分析 API

**Files:**
- Create: `app/api/style/analyze/route.ts`
- Create: `lib/style/validation.ts`

**Step 1: 创建 Zod 验证**

```typescript
// lib/style/validation.ts

import { z } from "zod";

export const AnalyzeStyleSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  includeBigFive: z.boolean().optional().default(false),
});

export const UpdateStylePreferenceSchema = z.object({
  learningStyle: z.object({
    preferredFormat: z.enum(["text", "video", "mixed", "audio", "interactive"]),
    pace: z.enum(["slow", "moderate", "fast", "adaptive"]),
  }).optional(),
});
```

**Step 2: 创建 API 路由**

```typescript
// app/api/style/analyze/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, APIError } from "@/lib/api";
import { AnalyzeStyleSchema } from "@/lib/style/validation";
import { updateUserStyleProfile } from "@/lib/style/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const { conversationId } = AnalyzeStyleSchema.parse(body);

    await updateUserStyleProfile(session.user.id, conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 3: Commit**

```bash
git add lib/style/validation.ts app/api/style/
git commit -m "feat(api): add style analysis endpoint"
```

---

## Task 6: 创建隐私设置表

**Files:**
- Modify: `db/schema.ts`

**Step 1: 添加隐私设置表**

在 `db/schema.ts` 中添加：

```typescript
// ============================================
// 风格分析隐私设置
// ============================================

export const stylePrivacySettings = pgTable(
  "style_privacy_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // 用户同意
    analysisEnabled: boolean("analysis_enabled").notNull().default(false),
    consentGivenAt: timestamp("consent_given_at"),

    // Big Five 分析（敏感数据）
    bigFiveEnabled: boolean("big_five_enabled").notNull().default(false),
    bigFiveConsentGivenAt: timestamp("big_five_consent_given_at"),

    // 数据保留
    autoDeleteAfterDays: integer("auto_delete_after_days").default(null),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("style_privacy_settings_user_id_idx").on(table.userId),
  }),
);
```

**Step 2: 添加类型导出**

```typescript
export type StylePrivacySettings = typeof stylePrivacySettings.$inferSelect;
export type NewStylePrivacySettings = typeof stylePrivacySettings.$inferInsert;
```

**Step 3: 生成迁移**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

**Step 4: Commit**

```bash
git add db/schema.ts drizzle/
git commit -m "feat(db): add style privacy settings table"
```

---

## Task 7: 创建隐私设置 API

**Files:**
- Create: `app/api/style/privacy/route.ts`

**Step 1: 创建隐私设置服务**

```typescript
// lib/style/privacy.ts

import { db, stylePrivacySettings, eq } from "@/db";

export async function getPrivacySettings(userId: string) {
  return await db.query.stylePrivacySettings.findFirst({
    where: eq(stylePrivacySettings.userId, userId),
  });
}

export async function updatePrivacySettings(
  userId: string,
  settings: {
    analysisEnabled?: boolean;
    bigFiveEnabled?: boolean;
    autoDeleteAfterDays?: number | null;
  }
) {
  const existing = await getPrivacySettings(userId);

  if (existing) {
    const [updated] = await db
      .update(stylePrivacySettings)
      .set({
        ...settings,
        ...(settings.analysisEnabled && !existing.analysisEnabled && { consentGivenAt: new Date() }),
        ...(settings.bigFiveEnabled && !existing.bigFiveEnabled && { bigFiveConsentGivenAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(stylePrivacySettings.userId, userId))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(stylePrivacySettings)
    .values({
      userId,
      analysisEnabled: settings.analysisEnabled ?? false,
      bigFiveEnabled: settings.bigFiveEnabled ?? false,
      autoDeleteAfterDays: settings.autoDeleteAfterDays,
      consentGivenAt: settings.analysisEnabled ? new Date() : null,
      bigFiveConsentGivenAt: settings.bigFiveEnabled ? new Date() : null,
    })
    .returning();

  return created;
}

export async function deleteStyleData(userId: string) {
  // 清除风格分析数据
  await db
    .update(userProfiles)
    .set({
      vocabularyComplexity: { value: 0.5, confidence: 0, samples: 0 },
      sentenceComplexity: { value: 0.5, confidence: 0, samples: 0 },
      abstractionLevel: { value: 0.5, confidence: 0, samples: 0 },
      directness: { value: 0.5, confidence: 0, samples: 0 },
      conciseness: { value: 0.5, confidence: 0, samples: 0 },
      formality: { value: 0.5, confidence: 0, samples: 0 },
      emotionalIntensity: { value: 0.5, confidence: 0, samples: 0 },
      openness: { value: 0.5, confidence: 0, samples: 0 },
      conscientiousness: { value: 0.5, confidence: 0, samples: 0 },
      extraversion: { value: 0.5, confidence: 0, samples: 0 },
      agreeableness: { value: 0.5, confidence: 0, samples: 0 },
      neuroticism: { value: 0.5, confidence: 0, samples: 0 },
      totalMessagesAnalyzed: 0,
      totalConversationsAnalyzed: 0,
      lastAnalyzedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  // 关闭分析
  await updatePrivacySettings(userId, {
    analysisEnabled: false,
    bigFiveEnabled: false,
  });
}
```

**Step 2: 创建 API 路由**

```typescript
// app/api/style/privacy/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, APIError } from "@/lib/api";
import {
  getPrivacySettings,
  updatePrivacySettings,
  deleteStyleData,
} from "@/lib/style/privacy";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const settings = await getPrivacySettings(session.user.id);

    return NextResponse.json({
      analysisEnabled: settings?.analysisEnabled ?? false,
      bigFiveEnabled: settings?.bigFiveEnabled ?? false,
      autoDeleteAfterDays: settings?.autoDeleteAfterDays,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();

    const settings = await updatePrivacySettings(session.user.id, body);

    return NextResponse.json({
      analysisEnabled: settings.analysisEnabled,
      bigFiveEnabled: settings.bigFiveEnabled,
      autoDeleteAfterDays: settings.autoDeleteAfterDays,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    await deleteStyleData(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 3: Commit**

```bash
git add lib/style/privacy.ts app/api/style/privacy/
git commit -m "feat(style): add privacy settings API"
```

---

## Task 8: 更新现有代码适配新 schema

**Files:**
- 搜索并修复所有使用旧字段的地方

**Step 1: 搜索引用**

```bash
# 搜索可能需要更新的文件
grep -r "learningGoals\|knowledgeAreas\|assessmentHistory\|currentLevel\|totalStudyMinutes\|profileEmbedding" --include="*.ts" --include="*.tsx" app/ lib/
```

**Step 2: 修复或删除引用**

根据搜索结果，更新或删除对旧字段的引用。

**Step 3: Commit**

```bash
git add .
git commit -m "refactor: update code for new user_profiles schema"
```

---

## 完成后检查清单

- [ ] 所有迁移成功运行
- [ ] TypeScript 类型检查通过 (`pnpm tsc`)
- [ ] 现有功能正常工作（profile page 加载）
- [ ] 风格分析 API 可以调用
- [ ] 隐私设置 API 可以调用
- [ ] 没有控制台错误

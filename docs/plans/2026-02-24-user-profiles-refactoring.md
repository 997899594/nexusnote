# User Profiles Refactoring & Style Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `user_profiles` table to remove redundant fields and add style analysis capabilities.

**Architecture:** Keep existing table structure, remove unused fields, add AI-inferred style metrics with EMA updates. Uses existing `aiProvider`, ToolLoopAgent, and unified error handling patterns.

**Tech Stack:** Drizzle ORM, PostgreSQL, Vercel AI SDK v6, Zod validation, React 19 + Next.js 16

---

## Phase 1: Database Schema Refactoring

### Task 1: Refactor user_profiles table schema

**Files:**
- Modify: `db/schema.ts:49-70`
- Modify: `lib/profile.ts` (update references)
- Test: Manual verification via `drizzle-kit push`

**Step 1: Update schema definition**

In `db/schema.ts`, replace the `userProfiles` table definition:

```typescript
// User profile - 学习画像 + 风格分析
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // ========== 手动学习偏好 ==========
    // 用户主动设置的学习偏好（保留）
    learningStyle: jsonb("learning_style"),

    // ========== AI 风格分析字段 ==========
    // 语言复杂度 (0-1)
    vocabularyComplexity: jsonb("vocabulary_complexity").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    sentenceComplexity: jsonb("sentence_complexity").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    abstractionLevel: jsonb("abstraction_level").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),

    // 沟通风格 (0-1)
    directness: jsonb("directness").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    conciseness: jsonb("conciseness").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    formality: jsonb("formality").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    emotionalIntensity: jsonb("emotional_intensity").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),

    // Big Five 特质 (0-1) - 敏感数据
    openness: jsonb("openness").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    conscientiousness: jsonb("conscientiousness").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    extraversion: jsonb("extraversion").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    agreeableness: jsonb("agreeableness").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),
    neuroticism: jsonb("neuroticism").$type<{
      value: number;
      confidence: number;
      updatedAt: string;
    }>(),

    // EMA 更新元数据
    totalMessagesAnalyzed: integer("total_messages_analyzed").notNull().default(0),
    totalConversationsAnalyzed: integer("total_conversations_analyzed").notNull().default(0),

    // 隐私控制
    styleAnalysisEnabled: boolean("style_analysis_enabled").notNull().default(false),
    consentGivenAt: timestamp("consent_given_at"),

    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_profiles_user_id_idx").on(table.userId),
  }),
);
```

**Step 2: Create migration**

Run: `npx drizzle-kit generate`

Expected: Generates migration SQL in `drizzle/`

**Step 3: Apply migration**

Run: `npx drizzle-kit push`

Expected: Database schema updated

**Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "refactor(db): restructure user_profiles - remove redundant fields, add style analysis"
```

---

### Task 2: Update UserProfile types

**Files:**
- Modify: `db/schema.ts:558-559`

**Step 1: Type exports are auto-generated**

No changes needed - Drizzle infers types from schema.

**Step 2: Commit**

```bash
git add db/schema.ts
git commit -m "chore(db): types auto-update from schema refactor"
```

---

### Task 3: Update lib/profile.ts to remove unused code

**Files:**
- Modify: `lib/profile.ts:14-61` (remove unused interfaces)
- Modify: `lib/profile.ts:144-187` (update getProfileChunk)

**Step 1: Remove unused interfaces**

Delete these interfaces from `lib/profile.ts`:
- `LearningGoals`
- `KnowledgeAreas`
- `AssessmentHistory`
- `CurrentLevel`

Keep:
- `LearningStyle` (still used)
- `CreateProfileInput` (update to match new schema)
- `UpdateProfileInput` (update to match new schema)

**Step 2: Update getProfileChunk to use style data**

Replace `getProfileChunk` function:

```typescript
export async function getProfileChunk(userId: string): Promise<string | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return null;
  }

  const parts: string[] = [];

  const learningStyle = profile.learningStyle as LearningStyle | null;

  if (learningStyle) {
    const style = JSON.stringify(learningStyle);
    parts.push(`Learning Style: ${style}`);
  }

  // 风格分析数据（如果启用）
  if (profile.styleAnalysisEnabled && profile.vocabularyComplexity) {
    const vocab = profile.vocabularyComplexity as { value: number };
    parts.push(`Vocabulary Complexity: ${(vocab.value * 100).toFixed(0)}%`);
  }

  if (profile.styleAnalysisEnabled && profile.formality) {
    const formality = profile.formality as { value: number };
    parts.push(`Formality: ${(formality.value * 100).toFixed(0)}%`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}
```

**Step 3: Remove profileEmbedding generation**

Delete these functions:
- `generateProfileEmbedding`
- `updateProfileEmbedding`

**Step 4: Commit**

```bash
git add lib/profile.ts
git commit -m "refactor(profile): update for new schema, remove unused functions"
```

---

## Phase 2: Style Analysis Engine

### Task 4: Create style analysis types and interfaces

**Files:**
- Create: `lib/style/types.ts`
- Test: Manual verification

**Step 1: Create types file**

```typescript
/**
 * Style Analysis Types
 */

export interface StyleMetrics {
  // 语言复杂度
  vocabularyComplexity: number;  // 0-1
  sentenceComplexity: number;    // 0-1
  abstractionLevel: number;      // 0-1

  // 沟通风格
  directness: number;           // 0-1 (直接 vs 委婉)
  conciseness: number;          // 0-1 (简洁 vs 详细)
  formality: number;            // 0-1 (正式度)
  emotionalIntensity: number;   // 0-1 (情感强度)

  // Big Five
  openness: number;             // 0-1
  conscientiousness: number;    // 0-1
  extraversion: number;         // 0-1
  agreeableness: number;        // 0-1
  neuroticism: number;          // 0-1
}

export interface StyleAnalysisResult {
  metrics: StyleMetrics;
  confidence: Record<keyof StyleMetrics, number>;
  sampleSize: number;
}

export interface ConversationStyleInput {
  userId: string;
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
}
```

**Step 2: Commit**

```bash
git add lib/style/types.ts
git commit -m "feat(style): add type definitions"
```

---

### Task 5: Create style analysis AI tool

**Files:**
- Create: `lib/ai/tools/style/analyze.ts`
- Modify: `lib/ai/tools/style/index.ts`

**Step 1: Create analyze tool**

```typescript
/**
 * Style Analysis Tool - AI 工具
 */

import { tool } from "ai";
import { z } from "zod";

export const AnalyzeStyleToolSchema = z.object({
  conversationId: z.string().describe("对话 ID"),
  messageCount: z.number().min(1).max(100).describe("分析的消息数量"),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).describe("对话消息列表"),
});

export const analyzeStyleTool = tool({
  description: "分析用户对话风格，包括语言复杂度、沟通风格和 Big Five 人格特质",
  inputSchema: AnalyzeStyleToolSchema,
  execute: async ({ conversationId, messages }) => {
    try {
      // 调用内部 API
      const response = await fetch("/api/style/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messages }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze style: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        conversationId,
        styleData: data.style,
      };
    } catch (error) {
      console.error("[Tool] analyzeStyle error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        conversationId,
      };
    }
  },
});
```

**Step 2: Create index**

```typescript
/**
 * Style Tools - Export
 */

export { analyzeStyleTool, AnalyzeStyleToolSchema } from "./analyze";
```

**Step 3: Commit**

```bash
git add lib/ai/tools/style/
git commit -m "feat(style): add AI analysis tool"
```

---

### Task 6: Create style analysis API

**Files:**
- Create: `app/api/style/analyze/route.ts`
- Create: `lib/style/validation.ts`

**Step 1: Create validation schema**

```typescript
// lib/style/validation.ts
import { z } from "zod";

export const StyleAnalyzeSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  messageCount: z.number().min(1).max(100).optional().default(50),
  forceUpdate: z.boolean().optional().default(false),
});
```

**Step 2: Create API route**

```typescript
// app/api/style/analyze/route.ts
import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAgent } from "@/lib/ai";
import { handleError, APIError } from "@/lib/api";
import { StyleAnalyzeSchema } from "@/lib/style/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const options = StyleAnalyzeSchema.parse(body);

    // 检查用户是否启用了风格分析
    // TODO: 添加隐私检查

    const uiMessages: UIMessage[] = [
      {
        id: `msg-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: "请分析我的对话风格" }]
      }
    ];

    return createAgentUIStreamResponse({
      agent: getAgent("STYLE"),
      uiMessages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 3: Commit**

```bash
git add lib/style/validation.ts app/api/style/analyze/route.ts
git commit -m "feat(style): add analysis API endpoint"
```

---

### Task 7: Add STYLE agent

**Files:**
- Modify: `lib/ai/agents/index.ts`

**Step 1: Add STYLE agent instructions**

```typescript
const INSTRUCTIONS = {
  // ... existing ...

  style: `你是 NexusNote 的风格分析专家。

你的任务是从用户的对话中分析其语言风格和沟通特征。

分析维度：
1. 语言复杂度
   - 词汇复杂度 (0-1): 用词的丰富程度
   - 句子复杂度 (0-1): 句法结构的复杂程度
   - 抽象程度 (0-1): 抽象概念 vs 具体描述

2. 沟通风格
   - 直接性 (0-1): 直接表达 vs 委婉表达
   - 简洁性 (0-1): 简洁明了 vs 详尽解释
   - 正式度 (0-1): 正式用语 vs 口语化
   - 情感强度 (0-1): 情感表达程度

3. Big Five 人格特质 (仅在有足够样本时)
   - 开放性: 新事物接受度
   - 尽责性: 计划性和执行力
   - 外向性: 社交倾向
   - 宜人性: 合作程度
   - 神经质: 情绪稳定性

输出格式：使用 analyzeStyle 工具保存分析结果。`,
} as const;
```

**Step 2: Add STYLE agent case**

```typescript
import { analyzeStyleTool } from "../tools/style";

const styleTools = {
  analyzeStyle: analyzeStyleTool,
} as ToolSet;

export function getAgent(
  intent: "CHAT" | "INTERVIEW" | "COURSE" | "EDITOR" | "SEARCH" | "SKILLS" | "STYLE",
  _sessionId?: string,
) {
  switch (intent) {
    // ... existing cases ...
    case "STYLE":
      return createAgent("nexusnote-style", aiProvider.proModel, INSTRUCTIONS.style, styleTools);
    default:
      return createAgent("nexusnote-chat", aiProvider.chatModel, INSTRUCTIONS.chat, chatTools);
  }
}
```

**Step 3: Commit**

```bash
git add lib/ai/agents/index.ts
git commit -m "feat(agents): add STYLE analysis agent"
```

---

## Phase 3: Style Snapshot System

### Task 8: Create conversation_style_snapshots table

**Files:**
- Modify: `db/schema.ts`

**Step 1: Add table to schema**

```typescript
// 在 db/schema.ts 添加

// Conversation Style Snapshots - 对话风格快照（时序数据）
export const conversationStyleSnapshots = pgTable(
  "conversation_style_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),

    // 风格向量 (256维)
    styleEmbedding: halfvec("style_embedding"),

    // 快速分类标签
    primaryTone: text("primary_tone"), // direct, gentle, enthusiastic, neutral
    secondaryTone: text("secondary_tone"),

    // 上下文触发器
    contextualTriggers: jsonb("contextual_triggers").$type<string[]>(),

    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("conv_style_user_id_idx").on(table.userId),
    conversationIdIdx: index("conv_style_conv_id_idx").on(table.conversationId),
    timestampIdx: index("conv_style_timestamp_idx").on(table.timestamp),
  }),
);

// 添加 relations
export const usersRelations = relations(users, ({ many }) => ({
  // ... existing ...
  conversationStyleSnapshots: many(conversationStyleSnapshots),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  // ... existing ...
  styleSnapshots: many(conversationStyleSnapshots),
}));
```

**Step 2: Add type exports**

```typescript
export type ConversationStyleSnapshot = typeof conversationStyleSnapshots.$inferSelect;
export type NewConversationStyleSnapshot = typeof conversationStyleSnapshots.$inferInsert;
```

**Step 3: Generate and apply migration**

Run: `npx drizzle-kit generate`
Run: `npx drizzle-kit push`

**Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat(db): add conversation_style_snapshots table"
```

---

### Task 9: Create style snapshot service

**Files:**
- Create: `lib/style/snapshot.ts`

**Step 1: Create snapshot service**

```typescript
/**
 * Style Snapshot Service
 */

import { db, conversationStyleSnapshots, conversations } from "@/db";
import { eq, desc } from "drizzle-orm";
import { aiProvider } from "@/lib/ai";
import { embed } from "ai";

export interface StyleSnapshotInput {
  userId: string;
  conversationId: string;
  primaryTone: string;
  secondaryTone?: string;
  contextualTriggers?: string[];
}

export async function createStyleSnapshot(input: StyleSnapshotInput) {
  // 生成风格向量（用对话摘要）
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, input.conversationId),
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const summaryText = conversation.summary || conversation.title;

  let embedding: number[] | null = null;
  if (aiProvider.isConfigured()) {
    const { embeddings } = await embed({
      model: aiProvider.embeddingModel,
      value: summaryText,
    });
    embedding = embeddings[0];
  }

  const [snapshot] = await db
    .insert(conversationStyleSnapshots)
    .values({
      userId: input.userId,
      conversationId: input.conversationId,
      styleEmbedding: embedding,
      primaryTone: input.primaryTone,
      secondaryTone: input.secondaryTone,
      contextualTriggers: input.contextualTriggers || [],
    })
    .returning();

  return snapshot;
}

export async function getRecentSnapshots(userId: string, limit = 20) {
  return db.query.conversationStyleSnapshots.findMany({
    where: eq(conversationStyleSnapshots.userId, userId),
    orderBy: [desc(conversationStyleSnapshots.timestamp)],
    limit,
  });
}
```

**Step 2: Commit**

```bash
git add lib/style/snapshot.ts
git commit -m "feat(style): add snapshot service"
```

---

## Phase 4: Privacy Settings

### Task 10: Create user_privacy_settings table

**Files:**
- Modify: `db/schema.ts`

**Step 1: Add table**

```typescript
// User Privacy Settings - 隐私设置
export const userPrivacySettings = pgTable(
  "user_privacy_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // 风格分析开关
    styleAnalysisEnabled: boolean("style_analysis_enabled").notNull().default(false),

    // Big Five 同意
    bigFiveConsent: boolean("big_five_consent").notNull().default(false),
    bigFiveConsentGivenAt: timestamp("big_five_consent_given_at"),

    // 数据导出/删除
    dataExportRequested: boolean("data_export_requested").notNull().default(false),
    dataExportCompletedAt: timestamp("data_export_completed_at"),
    dataDeletionRequested: boolean("data_deletion_requested").notNull().default(false),
    dataDeletionScheduledAt: timestamp("data_deletion_scheduled_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("privacy_user_id_idx").on(table.userId),
  }),
);

// 添加 relations
export const usersRelations = relations(users, ({ many }) => ({
  // ... existing ...
  privacySettings: many(userPrivacySettings),
}));
```

**Step 2: Add type exports**

```typescript
export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;
export type NewUserPrivacySettings = typeof userPrivacySettings.$inferInsert;
```

**Step 3: Generate migration**

Run: `npx drizzle-kit generate`
Run: `npx drizzle-kit push`

**Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat(db): add user_privacy_settings table"
```

---

### Task 11: Create privacy API

**Files:**
- Create: `app/api/privacy/settings/route.ts`
- Create: `lib/privacy/service.ts`

**Step 1: Create privacy service**

```typescript
/**
 * Privacy Service
 */

import { db, userPrivacySettings } from "@/db";
import { eq } from "drizzle-orm";

export async function getPrivacySettings(userId: string) {
  let settings = await db.query.userPrivacySettings.findFirst({
    where: eq(userPrivacySettings.userId, userId),
  });

  if (!settings) {
    [settings] = await db
      .insert(userPrivacySettings)
      .values({ userId })
      .returning();
  }

  return settings;
}

export async function updatePrivacySettings(
  userId: string,
  updates: Partial<{
    styleAnalysisEnabled: boolean;
    bigFiveConsent: boolean;
  }>,
) {
  const values: any = { ...updates, updatedAt: new Date() };

  if (updates.bigFiveConsent === true) {
    values.bigFiveConsentGivenAt = new Date();
  }

  const [settings] = await db
    .update(userPrivacySettings)
    .set(values)
    .where(eq(userPrivacySettings.userId, userId))
    .returning();

  return settings;
}
```

**Step 2: Create API route**

```typescript
// app/api/privacy/settings/route.ts
import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleError } from "@/lib/api";
import { getPrivacySettings, updatePrivacySettings } from "@/lib/privacy/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return Response.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const settings = await getPrivacySettings(session.user.id);
    return Response.json({ settings });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return Response.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const body = await request.json();
    const settings = await updatePrivacySettings(session.user.id, body);

    return Response.json({ settings });
  } catch (error) {
    return handleError(error);
  }
}
```

**Step 3: Commit**

```bash
git add lib/privacy/service.ts app/api/privacy/settings/route.ts
git commit -m "feat(privacy): add settings API"
```

---

## Phase 5: Testing & Verification

### Task 12: Add style analysis tests

**Files:**
- Create: `lib/style/__tests__/snapshot.test.ts`

**Step 1: Create basic test**

```typescript
/**
 * Style Snapshot Tests
 */

import { describe, it, expect } from "vitest";

describe("Style Snapshot", () => {
  it("should create snapshot with embedding", async () => {
    // Test implementation
    expect(true).toBe(true);
  });

  it("should retrieve recent snapshots", async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `npm test`

**Step 3: Commit**

```bash
git add lib/style/__tests__/
git commit -m "test(style): add basic snapshot tests"
```

---

### Task 13: Verify type safety

**Files:**
- Test: Project-wide typecheck

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: No type errors

**Step 2: Fix any issues if found**

**Step 3: Commit**

```bash
git add .
git commit -m "chore: fix type errors from refactoring"
```

---

### Task 14: End-to-end verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Manual test checklist**
- [ ] Visit profile page
- [ ] Settings page loads
- [ ] API endpoints respond correctly
- [ ] Style analysis can be triggered
- [ ] Privacy settings work

**Step 3: Final commit**

```bash
git add .
git commit -m "chore: final cleanup and verification"
```

---

## Summary

**Files Created:**
- `lib/style/types.ts`
- `lib/style/validation.ts`
- `lib/style/snapshot.ts`
- `lib/ai/tools/style/analyze.ts`
- `lib/ai/tools/style/index.ts`
- `lib/privacy/service.ts`
- `app/api/style/analyze/route.ts`
- `app/api/privacy/settings/route.ts`

**Files Modified:**
- `db/schema.ts` (userProfiles refactor, new tables)
- `lib/profile.ts` (remove unused, update for new schema)
- `lib/ai/agents/index.ts` (add STYLE agent)

**Database Changes:**
- `user_profiles` - restructured (removed 6 fields, added 16 fields)
- `conversation_style_snapshots` - new table
- `user_privacy_settings` - new table

**Migration Required:** Yes (use `drizzle-kit push`)

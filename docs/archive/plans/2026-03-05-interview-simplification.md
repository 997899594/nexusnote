# Interview Agent Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify Interview Agent to single-phase with three tools, removing complexity assessment entirely.

**Architecture:** Single interview agent with updateProfile, suggestOptions, confirmOutline tools. No phase switching, no complexity evaluation. Prompt enforces "one question per turn".

**Tech Stack:** Next.js 16, AI SDK v6, Drizzle ORM, PostgreSQL

---

## Task 1: Simplify Interview Agent

**Files:**
- Modify: `lib/ai/agents/interview.ts`

**Step 1: Replace entire file with simplified version**

```typescript
/**
 * INTERVIEW Agent - 单阶段访谈
 *
 * 简化原则：
 * 1. 无复杂度评估
 * 2. 无阶段切换
 * 3. prompt 控制行为
 */

import { stepCountIs, ToolLoopAgent } from "ai";
import { aiProvider } from "../core";
import { createInterviewTools } from "../tools/interview";

const MAX_STEPS = 12;

const INSTRUCTIONS = `你是课程规划师。通过自然对话了解用户的学习需求。

规则：
- 每轮只问一个问题
- 回复后必须调用 suggestOptions 提供 3-4 个选项
- 收集足够信息后调用 confirmOutline 生成大纲

像朋友聊天，简洁自然。`;

export interface InterviewOptions {
  courseProfileId: string;
}

export function createInterviewAgent(options: InterviewOptions) {
  if (!options.courseProfileId) {
    throw new Error("courseProfileId required");
  }

  return new ToolLoopAgent({
    id: "interview",
    model: aiProvider.chatModel,
    instructions: INSTRUCTIONS,
    tools: createInterviewTools(options.courseProfileId),
    stopWhen: stepCountIs(MAX_STEPS),
  });
}
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors (will fail - need to update tools first)

---

## Task 2: Simplify Interview Tools

**Files:**
- Modify: `lib/ai/tools/interview/index.ts`

**Step 1: Replace entire file with simplified version**

```typescript
/**
 * Interview Tools - 单阶段工具集
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { DomainComplexity, InterviewProfile } from "@/db/schema";

// ============================================
// Schemas
// ============================================

export const UpdateProfileSchema = z.object({
  background: z.string().optional().describe("用户背景"),
  currentLevel: z.enum(["none", "beginner", "intermediate", "advanced"]).optional(),
  targetOutcome: z.string().optional().describe("期望成果"),
  timeConstraints: z.string().optional().describe("时间限制"),
  insights: z.array(z.string()).optional().describe("洞察"),
});

export const SuggestOptionsSchema = z.object({
  options: z.array(z.string()).min(2).max(6).describe("选项列表"),
});

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number(),
  modules: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        chapters: z.array(z.string()),
      }),
    )
    .min(1),
});

// ============================================
// Tools Factory
// ============================================

export function createInterviewTools(courseProfileId: string) {
  return {
    updateProfile: tool({
      description: "更新学习画像。",
      inputSchema: UpdateProfileSchema,
      execute: async (updates) => {
        const [existing] = await db
          .select()
          .from(courseSessions)
          .where(eq(courseSessions.id, courseProfileId))
          .limit(1);

        if (!existing) return { success: false, error: "课程不存在" };

        const current = (existing.interviewProfile as InterviewProfile) || {};
        const updated: InterviewProfile = {
          goal: current.goal ?? null,
          domain: current.domain ?? null,
          complexity: current.complexity ?? "moderate",
          background: updates.background ?? current.background ?? null,
          currentLevel: updates.currentLevel ?? current.currentLevel ?? "none",
          targetOutcome: updates.targetOutcome ?? current.targetOutcome ?? null,
          timeConstraints: updates.timeConstraints ?? current.timeConstraints ?? null,
          insights: [...new Set([...(current.insights || []), ...(updates.insights || [])])],
          readiness: updates.readiness ?? current.readiness ?? 0,
          estimatedTurns: current.estimatedTurns ?? 3,
          currentTurn: (current.currentTurn ?? 0) + 1,
        };

        await db
          .update(courseSessions)
          .set({ interviewProfile: updated, updatedAt: new Date() })
          .where(eq(courseSessions.id, courseProfileId));

        return { success: true };
      },
    }),

    suggestOptions: tool({
      description: "提供选项供用户选择。每轮回复后调用。",
      inputSchema: SuggestOptionsSchema,
      execute: async ({ options }) => ({
        success: true,
        options,
        message: "请选择或输入自定义内容",
      }),
    }),

    confirmOutline: tool({
      description: "生成并保存课程大纲。访谈结束时调用。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline) => {
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

        return { success: true, outline: outlineData };
      },
    }),
  };
}

export type { DomainComplexity, InterviewProfile };
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors (may need to update agents/index.ts)

---

## Task 3: Update Agent Factory

**Files:**
- Modify: `lib/ai/agents/index.ts`

**Step 1: Simplify InterviewOptions type**

Change the import and remove InterviewPhase:

```typescript
import { createInterviewAgent, type InterviewOptions } from "./interview";
```

**Step 2: Update exports**

```typescript
export type { PersonalizationOptions, InterviewOptions, SkillsAgentOptions };
```

**Step 3: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

---

## Task 4: Simplify Interview API

**Files:**
- Modify: `app/api/interview/route.ts`

**Step 1: Remove phase logic, simplify state resolution**

Replace `resolveInterviewState` function:

```typescript
async function resolveInterviewState(
  userId: string,
  inputCourseId: string | undefined,
  messages: UIMessage[],
): Promise<{ courseId: string }> {
  // 1. 尝试获取现有课程
  if (inputCourseId) {
    const existing = await db.query.courseSessions.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, inputCourseId!), eq(c.userId, userId)),
    });

    if (existing) {
      return { courseId: existing.id };
    }
  }

  // 2. 创建新课程
  const firstUserMessage = messages.find((m) => m.role === "user");
  let goal = "学习新知识";

  if (firstUserMessage?.parts) {
    const textPart = firstUserMessage.parts.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      goal = textPart.text.slice(0, 200);
    }
  }

  const [newCourse] = await db
    .insert(courseSessions)
    .values({
      userId,
      title: goal,
      interviewProfile: {
        goal,
        domain: null,
        complexity: "moderate",
        background: null,
        currentLevel: "none",
        targetOutcome: null,
        timeConstraints: null,
        insights: [],
        readiness: 0,
        estimatedTurns: 3,
        currentTurn: 0,
      } satisfies InterviewProfile,
      interviewStatus: "interviewing",
      status: "idle",
    })
    .returning();

  console.log("[Interview] Created course:", newCourse.id);

  return { courseId: newCourse.id };
}
```

**Step 2: Simplify POST handler**

Update the agent creation:

```typescript
const state = await resolveInterviewState(userId, validation.data.courseId, messages as UIMessage[]);

const agent = createInterviewAgent({
  courseProfileId: state.courseId,
});
```

**Step 3: Remove phase header**

Remove: `response.headers.set("X-Interview-Phase", state.phase);`

**Step 4: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

---

## Task 5: Verify Frontend Hook

**Files:**
- Verify: `hooks/useInterview.ts` (no changes needed)

The hook already:
- Passes `courseId` back to API
- Listens for `confirmOutline` and `assessComplexity` tool results

**Step 1: Remove assessComplexity listener (optional cleanup)**

The hook has a listener for `assessComplexity` to get `estimatedTurns`. Since we removed it, this listener will never trigger. Can leave as-is or remove.

---

## Task 6: Final Verification

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 2: Manual test**

Run: `bun dev`
Visit: http://localhost:3000/interview

Test:
1. Start interview with "我想学做 PPT"
2. Verify AI asks only one question
3. Verify options appear as buttons
4. Continue conversation
5. Verify `confirmOutline` triggers panel animation

---

## Summary

| File | Change |
|------|--------|
| `lib/ai/agents/interview.ts` | Single-phase agent, simplified prompt |
| `lib/ai/tools/interview/index.ts` | Only 3 tools, no complexity assessment |
| `lib/ai/agents/index.ts` | Remove InterviewPhase type |
| `app/api/interview/route.ts` | Remove phase logic |

## Removed Complexity

- ❌ `createAssessmentTools`
- ❌ `createConversationTools`
- ❌ `createCompletionTools`
- ❌ `assessComplexity` tool
- ❌ Phase switching in API
- ❌ Complexity-based prompts

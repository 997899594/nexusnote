# Intelligent Interview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rigid 3-indicator FSM interview with a prompt-driven, model-autonomous interview that only uses `confirmOutline` as its single tool.

**Architecture:** Delete `computePhase` FSM, `InterviewState`, `updateProfile` tool. Rewrite `INTERVIEW_PROMPT` to describe good interview behavior instead of fixed collection sequence. `ToolLoopAgent` uses static `instructions` (no `prepareCall`). Frontend monitors only `confirmOutline` via official `isToolUIPart` + `getToolName` type guards.

**Tech Stack:** AI SDK v6 (`ToolLoopAgent`, `isToolUIPart`, `getToolName`), Zustand, Next.js 16, Zod

**Spec:** `docs/archive/superpowers/specs/2026-03-13-intelligent-interview-design.md`

**Note:** This project has no automated tests yet. Verification is `bun run typecheck`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `stores/interview.ts` | Modify | Remove profile state, update `OutlineData` type |
| `lib/ai/prompts/interview.ts` | Rewrite | New prompt (no FSM), remove `getPhasePrompt` |
| `lib/ai/tools/interview/index.ts` | Rewrite | Remove `updateProfile`, new `ConfirmOutlineSchema` |
| `lib/ai/tools/index.ts` | Modify | `buildAgentTools("interview")` returns only `confirmOutline` + shared |
| `lib/ai/agents/interview.ts` | Rewrite | No `prepareCall`, no DB reads, static instructions |
| `app/api/interview/route.ts` | Simplify | Remove profile/outline resolution, just resolve courseId |
| `hooks/useInterview.ts` | Modify | Official type guards, only monitor `confirmOutline` |
| `components/interview/OutlinePanel.tsx` | Modify | Accept new `OutlineData` shape |
| `app/interview/page.tsx` | Modify | Remove profile UI, keep round counter |
| `lib/ai/schemas/interview.ts` | Delete | No longer needed |

---

## Chunk 1: Backend Core

### Task 1: Rewrite interview store types

**Files:**
- Modify: `stores/interview.ts`

- [ ] **Step 1: Rewrite the store**

Remove `LearningLevel`, `InterviewProfileState`, `profile`, `setProfile`. Update `OutlineData` and `Chapter` to match new schema.

```typescript
// stores/interview.ts
import { create } from "zustand";

export interface Chapter {
  title: string;
  description: string;
  topics: string[];
  estimatedMinutes?: number;
  practiceType?: "exercise" | "project" | "quiz" | "none";
}

export interface OutlineData {
  title: string;
  description: string;
  targetAudience: string;
  prerequisites?: string[];
  estimatedHours: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  chapters: Chapter[];
  learningOutcome: string;
}

interface InterviewStore {
  outline: OutlineData | null;
  courseId: string | null;
  isOutlineLoading: boolean;
  interviewCompleted: boolean;

  setOutline: (outline: OutlineData | null) => void;
  setCourseId: (id: string | null) => void;
  setIsOutlineLoading: (loading: boolean) => void;
  setInterviewCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialState = {
  outline: null,
  courseId: null,
  isOutlineLoading: false,
  interviewCompleted: false,
};

export const useInterviewStore = create<InterviewStore>((set) => ({
  ...initialState,

  setOutline: (outline: OutlineData | null) => {
    set({ outline });
  },

  setCourseId: (id: string | null) => {
    set({ courseId: id });
  },

  setIsOutlineLoading: (loading: boolean) => {
    set({ isOutlineLoading: loading });
  },

  setInterviewCompleted: (completed: boolean) => {
    set({ interviewCompleted: completed });
  },

  reset: () => {
    set(initialState);
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add stores/interview.ts
git commit -m "refactor(store): remove profile state, update OutlineData for intelligent interview"
```

---

### Task 2: Rewrite interview prompt

**Files:**
- Modify: `lib/ai/prompts/interview.ts`

- [ ] **Step 1: Replace entire file**

Delete `getPhasePrompt`, remove imports from `schemas/interview`. Write new prompt-driven instructions.

```typescript
// lib/ai/prompts/interview.ts

export const INTERVIEW_PROMPT = `你是 NexusNote 的课程规划师。通过自然对话深入了解用户的学习需求，然后生成高质量的个性化课程大纲。

## 访谈策略

- 像一个有经验的导师，通过对话了解学生
- 根据用户回答的深度和清晰度决定是否追问
- 不要机械地逐条提问，让对话自然流动
- 用户表达清晰时可以少问，模糊时要深挖
- 一般 2-5 轮对话即可，不要拖沓

## 你需要理解的维度（不是固定顺序，不是必须全问）

- 学什么、为什么学（目标和动机）
- 现在懂多少（知识基础）
- 学完想达到什么程度（期望成果）
- 有多少时间、什么偏好（学习条件，可选）

## 何时生成大纲

当你觉得对用户需求的理解足够生成一份有针对性的大纲时，直接调用 confirmOutline。
不需要等用户确认，不需要集齐所有维度。信息够用就行。

## 大纲修改

用户对大纲提出修改意见时，理解需求后再次调用 confirmOutline 生成更新版本。

## 对话风格

像朋友聊天，简洁自然，每轮只问一个问题。`;
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai/prompts/interview.ts
git commit -m "refactor(prompt): rewrite interview prompt for model-autonomous flow"
```

---

### Task 3: Rewrite interview tools

**Files:**
- Modify: `lib/ai/tools/interview/index.ts`

- [ ] **Step 1: Replace file contents**

Remove `updateProfile`, `UpdateProfileSchema`, `UpdateProfileOutput`. Rewrite `ConfirmOutlineSchema` with enriched fields. Keep `confirmOutline` tool logic (DB write) intact.

```typescript
// lib/ai/tools/interview/index.ts

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { ToolContext } from "@/lib/ai/core/tool-context";

// ============================================
// Schema
// ============================================

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().describe("一句话课程描述"),
  targetAudience: z.string().describe("适合谁学"),
  prerequisites: z.array(z.string()).optional().describe("前置知识要求"),
  estimatedHours: z.number().describe("预计总学时（小时）"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("整体难度"),
  chapters: z
    .array(
      z.object({
        title: z.string().describe("章节标题"),
        description: z.string().describe("章节简介"),
        topics: z.array(z.string()).describe("知识点列表"),
        estimatedMinutes: z.number().optional().describe("预计学习时长（分钟）"),
        practiceType: z
          .enum(["exercise", "project", "quiz", "none"])
          .optional()
          .describe("实践类型"),
      }),
    )
    .min(1)
    .describe("章节列表"),
  learningOutcome: z.string().describe("学完能做什么"),
});

// ============================================
// Types
// ============================================

export interface ConfirmOutlineOutput {
  success: boolean;
  outline?: z.infer<typeof ConfirmOutlineSchema>;
  error?: string;
}

// ============================================
// Tool Factory
// ============================================

export const createInterviewTools = (ctx: ToolContext) => {
  const courseId = ctx.resourceId;

  if (!courseId) {
    throw new Error("Interview tools require resourceId (courseId)");
  }

  return {
    confirmOutline: tool({
      description:
        "生成或更新课程大纲。当你对用户需求了解充分时调用。用户提出修改建议时再次调用更新。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline): Promise<ConfirmOutlineOutput> => {
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: Math.round(outline.estimatedHours * 60),
            outlineData: outline,
            interviewStatus: "completed",
            status: "outline_confirmed",
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseId));

        return { success: true, outline };
      },
    }),
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "refactor(tools): remove updateProfile, enrich ConfirmOutlineSchema"
```

---

### Task 4: Update tools index

**Files:**
- Modify: `lib/ai/tools/index.ts`

- [ ] **Step 1: Verify `buildAgentTools` interview branch**

The `buildAgentTools` function's `case "interview"` block calls `toolRegistry.resource.interview(ctx)` which is `createInterviewTools`. Since `createInterviewTools` now only returns `confirmOutline`, this already works correctly — no code change needed in this file.

However, verify that exports are correct. The `export * from "./interview"` re-exports from `lib/ai/tools/interview/index.ts`. Since we removed `UpdateProfileSchema` and `UpdateProfileOutput`, check nothing else imports them.

Run: `bun run typecheck` — expect errors from files not yet updated (agent, hook, route). These are fixed in subsequent tasks. If the only errors are from those files, this task is done.

- [ ] **Step 2: Commit** (only if changes were needed)

---

### Task 5: Rewrite interview agent

**Files:**
- Modify: `lib/ai/agents/interview.ts`

- [ ] **Step 1: Replace file contents**

Remove `prepareCall`, DB imports, state generics, `InterviewState` import. Use static `instructions`.

```typescript
// lib/ai/agents/interview.ts

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createToolContext } from "../core/tool-context";
import { INTERVIEW_PROMPT } from "../prompts/interview";
import { buildAgentTools } from "../tools";

const MAX_STEPS = 15;

// ============================================
// Types
// ============================================

export interface InterviewAgentOptions {
  userId: string;
  courseId: string;
  messages?: import("ai").UIMessage[];
}

// ============================================
// Agent Factory
// ============================================

export function createInterviewAgent(options: InterviewAgentOptions) {
  if (!options.courseId) {
    throw new Error("Interview agent requires courseId");
  }

  const ctx = createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });

  const tools = buildAgentTools("interview", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    instructions: INTERVIEW_PROMPT,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai/agents/interview.ts
git commit -m "refactor(agent): remove FSM, use static prompt-driven instructions"
```

---

### Task 6: Simplify interview route

**Files:**
- Modify: `app/api/interview/route.ts`

- [ ] **Step 1: Simplify the route**

Remove `InterviewProfile` import, `InterviewState` import. Simplify `resolveInterviewState` to only resolve/create courseId — no profile, no outline check. Remove initial profile creation for new courses (just create with title).

```typescript
// app/api/interview/route.ts

import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { courseSessions, db } from "@/db";
import { aiProvider, validateRequest } from "@/lib/ai";
import { createInterviewAgent } from "@/lib/ai/agents/interview";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
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

    const validation = validateRequest(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: validation.error.issues } },
        { status: 400 },
      );
    }

    const { messages, sessionId, courseId: inputCourseId } = validation.data;

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    const { courseId } = await resolveOrCreateCourse(
      userId,
      inputCourseId,
      messages as UIMessage[],
    );

    const agent = createInterviewAgent({
      userId,
      courseId,
      messages: messages as UIMessage[],
    });

    const response = await createNexusNoteStreamResponse(agent, messages as UIMessage[], {
      sessionId,
      resourceId: courseId,
    });

    return response;
  } catch (error) {
    return handleError(error);
  }
}

async function resolveOrCreateCourse(
  userId: string,
  inputCourseId: string | null | undefined,
  messages: UIMessage[],
): Promise<{ courseId: string }> {
  if (inputCourseId) {
    const existing = await db.query.courseSessions.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, inputCourseId), eq(c.userId, userId)),
      columns: { id: true },
    });

    if (existing) {
      return { courseId: existing.id };
    }
  }

  // Extract title from first user message
  const firstUserMessage = messages.find((m) => m.role === "user");
  let title = "新课程";

  if (firstUserMessage?.parts) {
    const textPart = firstUserMessage.parts.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      title = textPart.text.slice(0, 100);
    }
  }

  const [newCourse] = await db
    .insert(courseSessions)
    .values({
      userId,
      title,
      interviewStatus: "interviewing",
      status: "idle",
    })
    .returning();

  return { courseId: newCourse.id };
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Run typecheck for backend**

Run: `bun run typecheck 2>&1 | head -30`

Expected: No errors from backend files (stores, prompts, tools, agent, route). May still have errors from hook/page (Task 7-8).

- [ ] **Step 3: Commit**

```bash
git add app/api/interview/route.ts
git commit -m "refactor(route): simplify interview route, remove profile concerns"
```

---

## Chunk 2: Frontend

### Task 7: Update interview hook

**Files:**
- Modify: `hooks/useInterview.ts`

- [ ] **Step 1: Replace file contents**

Use `isToolUIPart` + `getToolName` from 'ai'. Remove `updateProfile` monitoring. Remove `UpdateProfileOutput`, `isToolPart`, `InterviewProfileState`, `LearningLevel` imports.

```typescript
// hooks/useInterview.ts

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { type OutlineData, useInterviewStore } from "@/stores/interview";

interface ConfirmOutlineOutput {
  success: boolean;
  outline?: OutlineData;
  error?: string;
}

interface UseInterviewOptions {
  initialMessage?: string;
}

interface UseInterviewReturn {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  status: string;
  isLoading: boolean;
  sessionId: string;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId, courseId: useInterviewStore.getState().courseId ?? undefined }),
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const newCourseId = response.headers.get("X-Resource-Id");
        if (newCourseId) {
          setCourseId(newCourseId);
        }
        return response;
      },
    }),
    onError: (error) => {
      console.error("[Interview] API Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
  });

  const { sendMessage, status, messages } = chat;

  // Auto-send initial message
  const sentInitialRef = useRef(false);
  const initialMessageRef = useRef(options?.initialMessage);

  useEffect(() => {
    initialMessageRef.current = options?.initialMessage;
  }, [options?.initialMessage]);

  useEffect(() => {
    const msg = initialMessageRef.current;
    if (msg && !sentInitialRef.current) {
      sentInitialRef.current = true;
      requestAnimationFrame(() => {
        sendMessage({ text: msg });
      });
    }
  }, [sendMessage]);

  // Monitor confirmOutline tool output
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      if (!msg.parts) continue;

      const confirmPart = msg.parts.find(
        (p) =>
          isToolUIPart(p) &&
          getToolName(p) === "confirmOutline" &&
          p.state === "output-available",
      );

      if (confirmPart && isToolUIPart(confirmPart)) {
        const output = confirmPart.output as ConfirmOutlineOutput | undefined;
        if (output?.success && output.outline) {
          setOutline(output.outline);
          setInterviewCompleted(true);
          setIsOutlineLoading(false);
          return;
        }
      }
    }
  }, [messages, setOutline, setInterviewCompleted, setIsOutlineLoading]);

  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    isLoading,
    sessionId,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useInterview.ts
git commit -m "refactor(hook): use official type guards, monitor only confirmOutline"
```

---

### Task 8: Update OutlinePanel component

**Files:**
- Modify: `components/interview/OutlinePanel.tsx`

- [ ] **Step 1: Update the component**

The component currently imports its own `OutlineData` and `Chapter` types. Update these to match the new schema (add `description`, `targetAudience`, `learningOutcome`, `estimatedHours`, per-chapter `estimatedMinutes`, `practiceType`). Import types from the store instead of defining locally.

Key changes:
- Import `type OutlineData, type Chapter` from `@/stores/interview`
- Remove local `Chapter` and `OutlineData` interfaces
- Update rendering to show new fields (`targetAudience`, `learningOutcome`, `prerequisites`, `estimatedHours`, chapter `practiceType`)
- Change `outline.estimatedMinutes` references to `outline.estimatedHours` (hours now)

Read the current `OutlinePanel.tsx` and modify it to:
1. Import types from store
2. Display `targetAudience` and `learningOutcome`
3. Display `estimatedHours` instead of `estimatedMinutes`
4. Display chapter-level `estimatedMinutes` and `practiceType` badges

- [ ] **Step 2: Commit**

```bash
git add components/interview/OutlinePanel.tsx
git commit -m "refactor(outline): update OutlinePanel for enriched outline schema"
```

---

### Task 9: Update interview page

**Files:**
- Modify: `app/interview/page.tsx`

- [ ] **Step 1: Remove profile-related code**

The page currently has a progress indicator showing `userMessageCount` dots. Keep this (it's useful for showing round count). Remove any references to `profile` or `setProfile` from the store. The page already doesn't directly use profile, but verify imports.

Key changes:
- Remove `addToolOutput` from hook destructuring (no longer in return type)
- Remove `addToolOutput` prop from `ChatMessage` component calls
- Verify `OutlinePanel` props still match (it takes `outline`, `isLoading`, `courseId`)

- [ ] **Step 2: Run full typecheck**

Run: `bun run typecheck 2>&1 | head -30`

Expected: Clean (or only pre-existing Bun fetch type error).

- [ ] **Step 3: Commit**

```bash
git add app/interview/page.tsx
git commit -m "refactor(page): remove profile references from interview page"
```

---

## Chunk 3: Cleanup

### Task 10: Delete schemas and cleanup

**Files:**
- Delete: `lib/ai/schemas/interview.ts`
- Verify: no remaining imports of deleted file

- [ ] **Step 1: Delete the schema file**

```bash
rm lib/ai/schemas/interview.ts
```

- [ ] **Step 2: Search for stale imports**

Search entire codebase for any remaining import of `schemas/interview`. Fix any found.

```bash
grep -r "schemas/interview" --include="*.ts" --include="*.tsx" .
```

Expected: No results.

- [ ] **Step 3: Final typecheck**

Run: `bun run typecheck 2>&1 | head -30`

Expected: Clean (or only pre-existing Bun fetch type error).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete interview FSM schema (no longer used)"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `bun run typecheck` passes (ignoring pre-existing Bun fetch error)
- [ ] `bun run lint` passes
- [ ] `lib/ai/schemas/interview.ts` no longer exists
- [ ] No file imports `computePhase`, `InterviewState`, `InterviewPhase`, `getPhasePrompt`, or `updateProfile`
- [ ] `stores/interview.ts` has no `profile` or `LearningLevel`
- [ ] `hooks/useInterview.ts` uses `isToolUIPart` + `getToolName` from 'ai'
- [ ] `lib/ai/agents/interview.ts` has no `prepareCall` and no DB imports
- [ ] `app/api/interview/route.ts` has no `InterviewProfile` import

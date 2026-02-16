# S-Tier Interview Engine 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 将 interview agent 从固定 4 阶段表单向导重写为 AI 自主控制深度和轮次的智能对话引擎，配合服务端画像管理和 BullMQ 后台课程生成。

**架构:** Flash 模型做对话（快），Pro 模型出大纲/课程（深）。服务端 DB 存 LearnerProfile（不再客户端推导）。BullMQ 做后台课程生成（不再 fire-and-forget）。AI SDK v6 的 `hasToolCall` + `prepareStep` 控制循环。

**技术栈:** AI SDK v6, Drizzle ORM, BullMQ, SSE, PostgreSQL, Redis, Next.js 16

---

## Task 1: 数据库 — 扩展 `courseProfiles` 表

**文件:**
- 修改: `packages/db/src/schema.ts`
- 运行: 迁移生成

**决策:** 不新建表。`courseProfiles` 本来就是 "Interview Agent 收集的用户信息 + 课程大纲"，直接加 3 个字段。

**Step 1: 在 courseProfiles 表定义中追加字段**

在 `designReason` 字段之后、`currentChapter` 之前添加:

```typescript
    // ─── S-Tier Interview Engine 新增字段 ───

    // AI 自主填充的学习者画像 (JSONB, 每轮 merge update)
    // 替代固定的 goal/background/targetOutcome/cognitiveStyle 四列
    // 大纲确认后从此字段提取填入旧列（兼容已有流程）
    interviewProfile: jsonb("interview_profile"),

    // AI SDK UIMessages 持久化（替代 localStorage）
    interviewMessages: jsonb("interview_messages"),

    // 会话状态
    // 'interviewing' | 'proposing' | 'confirmed' | 'generating' | 'completed'
    interviewStatus: text("interview_status").default("interviewing"),
```

旧的 goal/background/targetOutcome/cognitiveStyle 四列保留，大纲确认后从 interviewProfile 提取填入。

**Step 2: 生成并执行迁移**

```bash
cd /Users/findbiao/projects/nexusnote
pnpm --filter @nexusnote/db drizzle-kit generate
pnpm --filter @nexusnote/db migrate
```

**Step 3: 类型检查**

```bash
pnpm --filter @nexusnote/db build
pnpm --filter @nexusnote/web typecheck
```

**Step 4: 提交**

```bash
git add packages/db/
git commit -m "feat(db): extend courseProfiles with interviewProfile, interviewMessages, interviewStatus"
```

---

## Task 2: 类型定义 — LearnerProfile + Zod Schema

**文件:**
- 重写: `apps/web/features/learning/types.ts`

**Step 1: 重写 types.ts**

```typescript
import { z } from "zod";

// ============================================
// LearnerProfile — AI 自主填充的学习者画像
// ============================================

export const LearnerProfileSchema = z.object({
  // 核心维度（nullable, AI 按需填充）
  goal: z.string().nullable().default(null),
  background: z.string().nullable().default(null),
  targetOutcome: z.string().nullable().default(null),
  constraints: z.string().nullable().default(null),
  preferences: z.string().nullable().default(null),

  // AI 推断的元信息
  domain: z.string().nullable().default(null),
  domainComplexity: z
    .enum(["trivial", "simple", "moderate", "complex", "expert"])
    .nullable()
    .default(null),
  goalClarity: z
    .enum(["vague", "clear", "precise"])
    .nullable()
    .default(null),
  backgroundLevel: z
    .enum(["none", "beginner", "intermediate", "advanced"])
    .nullable()
    .default(null),

  // 自由洞察（追加式）
  insights: z.array(z.string()).default([]),

  // 就绪度
  readiness: z.number().min(0).max(100).default(0),
  missingInfo: z.array(z.string()).default([]),
});

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;

export const EMPTY_PROFILE: LearnerProfile = LearnerProfileSchema.parse({});

// ============================================
// updateProfile 工具输入 Schema
// ============================================

export const UpdateProfileInputSchema = z.object({
  updates: z.object({
    goal: z.string().nullish(),
    background: z.string().nullish(),
    targetOutcome: z.string().nullish(),
    constraints: z.string().nullish(),
    preferences: z.string().nullish(),
    domain: z.string().nullish(),
    domainComplexity: z
      .enum(["trivial", "simple", "moderate", "complex", "expert"])
      .nullish(),
    goalClarity: z.enum(["vague", "clear", "precise"]).nullish(),
    backgroundLevel: z
      .enum(["none", "beginner", "intermediate", "advanced"])
      .nullish(),
    insights: z.array(z.string()).nullish(),
    readiness: z.number().min(0).max(100),
    missingInfo: z.array(z.string()),
  }),
});

// ============================================
// suggestOptions 工具输入 Schema
// ============================================

export const SuggestOptionsSchema = z.object({
  options: z.array(z.string()).min(2).max(5)
    .describe("根据当前话题动态生成的 2-5 个选项，用户可选可不选"),
});

// ============================================
// proposeOutline 工具输入 Schema
// ============================================

export const ProposeOutlineSchema = z.object({
  summary: z.string().describe("对用户需求的一段话总结"),
  suggestedTitle: z.string().describe("建议的课程标题"),
});

// ============================================
// Interview Session 状态
// ============================================

export type InterviewStatus =
  | "interviewing"
  | "proposing"
  | "confirmed"
  | "generating"
  | "completed";

// 前端 Phase（从 InterviewStatus 映射）
export type InterviewPhase =
  | "interviewing"
  | "proposing"
  | "reviewing"
  | "generating"
  | "completed";
```

**Step 2: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 3: 提交**

```bash
git add apps/web/features/learning/types.ts
git commit -m "feat(types): define LearnerProfile schema and interview tool schemas"
```

---

## Task 3: 服务层 — Interview Session CRUD（基于 courseProfiles）

**文件:**
- 新建: `apps/web/features/learning/services/interview-session.ts`

**Step 1: 创建 interview-session.ts**

所有操作基于 `courseProfiles` 表的新字段（interviewProfile, interviewMessages, interviewStatus）。

```typescript
import { db, eq, and, courseProfiles } from "@nexusnote/db";
import {
  type LearnerProfile,
  LearnerProfileSchema,
  EMPTY_PROFILE,
  type InterviewStatus,
} from "@/features/learning/types";

// ─── 创建 Session（创建一条 courseProfiles 记录）───

export async function createInterviewSession(
  userId: string,
  initialGoal: string,
): Promise<string> {
  const profile: LearnerProfile = {
    ...EMPTY_PROFILE,
    goal: initialGoal,
    goalClarity: "vague",
    readiness: 5,
    missingInfo: ["领域和复杂度", "学习背景", "预期成果"],
  };

  const id = crypto.randomUUID();

  await db.insert(courseProfiles).values({
    id,
    userId,
    // 旧列先填占位值，大纲确认后再从 profile 提取填入
    goal: initialGoal,
    background: "",
    targetOutcome: "",
    cognitiveStyle: "",
    title: initialGoal,
    difficulty: "intermediate",
    estimatedMinutes: 0,
    outlineData: {},
    // 新列
    interviewProfile: profile,
    interviewMessages: [],
    interviewStatus: "interviewing",
  });

  return id;
}

// ─── 读取 Session ───

export async function getInterviewSession(sessionId: string, userId: string) {
  const session = await db.query.courseProfiles.findFirst({
    where: and(
      eq(courseProfiles.id, sessionId),
      eq(courseProfiles.userId, userId),
    ),
  });
  if (!session) throw new Error("Interview session not found");
  return session;
}

// ─── 读取 Profile ───

export async function getProfile(sessionId: string): Promise<LearnerProfile> {
  const session = await db.query.courseProfiles.findFirst({
    where: eq(courseProfiles.id, sessionId),
    columns: { interviewProfile: true },
  });
  if (!session) throw new Error("Session not found");
  return LearnerProfileSchema.parse(session.interviewProfile || EMPTY_PROFILE);
}

// ─── Merge Profile（部分更新）───

export async function mergeProfile(
  sessionId: string,
  updates: Record<string, unknown>,
): Promise<LearnerProfile> {
  const current = await getProfile(sessionId);

  // insights 追加不覆盖
  const newInsights = updates.insights as string[] | undefined;
  const mergedInsights = newInsights
    ? [...current.insights, ...newInsights]
    : current.insights;

  // 其他字段：非 null 值覆盖
  const merged: LearnerProfile = { ...current };
  for (const [key, value] of Object.entries(updates)) {
    if (key === "insights") continue;
    if (value != null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  merged.insights = mergedInsights;

  const validated = LearnerProfileSchema.parse(merged);

  await db
    .update(courseProfiles)
    .set({ interviewProfile: validated, updatedAt: new Date() })
    .where(eq(courseProfiles.id, sessionId));

  return validated;
}

// ─── 更新状态 ───

export async function updateInterviewStatus(
  sessionId: string,
  status: InterviewStatus,
) {
  await db
    .update(courseProfiles)
    .set({ interviewStatus: status, updatedAt: new Date() })
    .where(eq(courseProfiles.id, sessionId));
}

// ─── 保存 Messages ───

export async function saveInterviewMessages(sessionId: string, messages: unknown[]) {
  await db
    .update(courseProfiles)
    .set({ interviewMessages: messages, updatedAt: new Date() })
    .where(eq(courseProfiles.id, sessionId));
}

// ─── 确认大纲（从 interviewProfile 提取填入旧列）───

export async function confirmOutlineAndSyncProfile(
  sessionId: string,
  outlineData: Record<string, unknown>,
) {
  const profile = await getProfile(sessionId);

  await db
    .update(courseProfiles)
    .set({
      // 同步旧列（兼容已有的 /learn 页面）
      goal: profile.goal || "",
      background: profile.background || "",
      targetOutcome: profile.targetOutcome || "",
      cognitiveStyle: profile.preferences || "",
      // 大纲数据
      title: (outlineData.title as string) || profile.goal || "",
      description: outlineData.description as string,
      difficulty: (outlineData.difficulty as string) || "intermediate",
      estimatedMinutes: (outlineData.estimatedMinutes as number) || 0,
      outlineData,
      // 状态
      interviewStatus: "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(courseProfiles.id, sessionId));
}
```

**Step 2: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 3: 提交**

```bash
git add apps/web/features/learning/services/
git commit -m "feat(services): add interview session CRUD with server-side profile management"
```

---

## Task 4: 动态 Prompt — 基于 LearnerProfile 构建

**文件:**
- 重写: `apps/web/features/shared/ai/prompts/interview.ts`

**Step 1: 重写 interview.ts**

```typescript
import type { LearnerProfile } from "@/features/learning/types";

/**
 * 构建 Interview Agent 系统提示
 *
 * 关键：这个 prompt 每轮通过 prepareStep 动态注入，
 * 所以 AI 每轮都看到最新的 profile 状态。
 */
export function buildInterviewPrompt(profile: LearnerProfile): string {
  const profileSection = buildProfileSection(profile);
  const depthGuide = buildDepthGuide(profile);

  return `你是 Nexus，一位经验丰富的学习顾问。你正在和一个聪明、有目标的学习者对话。

## 你的任务
通过自然对话了解这个人想学什么、为什么学、基础如何，然后设计一个真正适合他的学习路径。

## 你的风格
- 像一个懂行的朋友在聊天，不像客服或问卷
- 说人话，不要模板化，不要每句话都加"好的"
- 一次只聊一个话题，不要一口气抛出多个问题
- 如果用户说得很清楚，不要重复确认，直接推进
- 展现你对领域的了解——如果用户说"学量子计算"，你应该知道这意味着需要线性代数基础

## 工具使用规则（严格遵守）
1. 每轮回复后 **必须** 调用 updateProfile，记录你获取的新信息和当前 readiness 评估
2. 每轮回复后 **必须** 调用 suggestOptions，提供 2-5 个动态选项。选项要贴合当前话题，不要泛泛而谈
3. 当 readiness >= 80 时，**不调用** suggestOptions，改为调用 proposeOutline 结束采访
4. 调用顺序：先说话 → 调 updateProfile → 调 suggestOptions 或 proposeOutline

## 当前学习者画像
${profileSection}

## 对话深度参考
${depthGuide}

## 就绪度评估标准
- 0-20: 只知道大方向，缺少具体信息
- 20-50: 知道目标和大致背景，但缺少预期或偏好
- 50-80: 核心信息齐全，可能还需确认细节
- 80-100: 信息充分，可以设计高质量课程大纲
`;
}

function buildProfileSection(p: LearnerProfile): string {
  const lines: string[] = [];

  lines.push(`目标: ${p.goal ?? "未知"}`);
  lines.push(`背景: ${p.background ?? "未知"}`);
  lines.push(`预期成果: ${p.targetOutcome ?? "未知"}`);
  if (p.constraints) lines.push(`限制条件: ${p.constraints}`);
  if (p.preferences) lines.push(`学习偏好: ${p.preferences}`);
  if (p.insights.length > 0) lines.push(`额外洞察: ${p.insights.join("; ")}`);

  lines.push("");
  lines.push(
    `领域: ${p.domain ?? "未识别"} | 复杂度: ${p.domainComplexity ?? "未评估"} | 目标清晰度: ${p.goalClarity ?? "未评估"} | 背景水平: ${p.backgroundLevel ?? "未评估"}`,
  );
  lines.push(`当前就绪度: ${p.readiness}/100`);

  if (p.missingInfo.length > 0) {
    lines.push(`还需了解: ${p.missingInfo.join(", ")}`);
  } else {
    lines.push("信息充足，可以考虑出大纲了");
  }

  return lines.join("\n");
}

function buildDepthGuide(p: LearnerProfile): string {
  const complexity = p.domainComplexity;

  if (complexity === "trivial" || complexity === "simple") {
    return "这是一个简单/实用型目标。1-3 轮对话应该足够。不要过度追问，快速出方案。";
  }
  if (complexity === "moderate") {
    return "这是一个中等复杂度目标。3-5 轮对话比较合理。确认背景和方向后可以出方案。";
  }
  if (complexity === "complex" || complexity === "expert") {
    return "这是一个复杂/专业目标。可能需要 5-10 轮深入对话。需要仔细了解基础水平和具体方向。";
  }
  return "领域复杂度尚未评估。先通过对话判断这个目标的复杂度，再决定对话深度。";
}
```

**Step 2: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 3: 提交**

```bash
git add apps/web/features/shared/ai/prompts/interview.ts
git commit -m "feat(prompts): rewrite interview prompt as dynamic LearnerProfile-based builder"
```

---

## Task 5: 核心 — 重写 Interview Agent

**文件:**
- 重写: `apps/web/features/learning/agent/interview-agent.ts`

**Step 1: 重写 interview-agent.ts**

```typescript
import {
  hasToolCall,
  type InferAgentUIMessage,
  stepCountIs,
  tool,
  ToolLoopAgent,
} from "ai";
import { z } from "zod";
import {
  ProposeOutlineSchema,
  SuggestOptionsSchema,
  UpdateProfileInputSchema,
} from "../types";
import { mergeProfile } from "../services/interview-session";
import { buildInterviewPrompt } from "@/features/shared/ai/prompts/interview";
import { getProfile } from "../services/interview-session";
import { registry } from "@/features/shared/ai/registry";

/**
 * Interview Agent 调用选项
 */
export const InterviewCallOptionsSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
});

export type InterviewCallOptions = z.infer<typeof InterviewCallOptionsSchema>;

// ─── Agent 工厂（需要 sessionId 来做 DB 操作）───

export function createInterviewAgent(sessionId: string) {
  const model = registry.chatModel;
  if (!model) {
    throw new Error("chatModel not available. Check AI configuration.");
  }

  return new ToolLoopAgent({
    id: "nexusnote-interview-v2",
    model,
    callOptionsSchema: InterviewCallOptionsSchema,

    // 不写静态 instructions — 由 prepareStep 动态注入
    instructions: "",

    tools: {
      // ─── 工具 1: 更新画像 (Server-side, 每轮必调) ───
      updateProfile: tool({
        description: `更新学习者画像。每轮对话后必须调用。
          只更新本轮获得的新信息字段，其他留 null。
          readiness 是你对"信息是否足够设计好课程"的评估（0-100）。
          missingInfo 列出你认为还需要了解的内容（空数组=信息充足）。`,
        inputSchema: UpdateProfileInputSchema,
        execute: async ({ updates }) => {
          const merged = await mergeProfile(sessionId, updates);
          return {
            saved: true,
            currentReadiness: merged.readiness,
          };
        },
      }),

      // ─── 工具 2: 快捷选项 (Client-side, 每轮必调) ───
      suggestOptions: tool({
        description: `每轮回复后必须调用（除非调用 proposeOutline）。
          根据当前话题动态生成 2-5 个选项。
          选项要贴合语境和用户情况，不要模板化。
          用户可以点击选项，也可以忽略直接打字。`,
        inputSchema: SuggestOptionsSchema,
        // 无 execute → client-side tool → 停止循环等用户
      }),

      // ─── 工具 3: 提议大纲 (Client-side, 终止信号) ───
      proposeOutline: tool({
        description: `当 readiness >= 80 时调用，替代 suggestOptions。
          调用前必须先用自然语言总结你对用户需求的理解。
          summary 是对用户需求的一段话总结。
          suggestedTitle 是你建议的课程标题。`,
        inputSchema: ProposeOutlineSchema,
        // 无 execute → client-side tool → 停止循环，客户端显示确认 UI
      }),
    },

    // ─── 停止条件 ───
    // suggestOptions 或 proposeOutline 都是 client-side tool，调用即停
    stopWhen: [
      hasToolCall("suggestOptions"),
      hasToolCall("proposeOutline"),
      stepCountIs(15),
    ],

    // ─── 每步准备：从 DB 加载最新 profile，动态重建系统 prompt ───
    prepareStep: async () => {
      const profile = await getProfile(sessionId);
      return {
        instructions: buildInterviewPrompt(profile),
      };
    },
  });
}

/**
 * 导出类型（用于前端 useChat 泛型）
 *
 * 注意: 由于 agent 是工厂函数创建的，需要用 ReturnType 推断
 */
type InterviewAgent = ReturnType<typeof createInterviewAgent>;
export type InterviewAgentMessage = InferAgentUIMessage<InterviewAgent>;
```

**Step 2: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

注意：这一步可能会有 import 错误，因为其他文件还在引用旧的导出（如 `InterviewContextSchema`）。先记录，后续 Task 中修复。

**Step 3: 提交**

```bash
git add apps/web/features/learning/agent/
git commit -m "feat(agent): rewrite interview agent with dynamic profile, adaptive depth, and client-side tools"
```

---

## Task 6: API 路由 — 支持 sessionId + agent 工厂

**文件:**
- 修改: `apps/web/app/api/chat/route.ts`
- 新建: `apps/web/app/api/interview/[id]/route.ts`

**Step 1: 修改 chat route.ts 的 INTERVIEW 分支**

将 INTERVIEW case 替换为:

```typescript
case "INTERVIEW": {
  const sessionId = body.sessionId as string | undefined;
  const initialGoal = body.initialGoal as string | undefined;

  // 需要 sessionId 或 initialGoal 来创建/恢复会话
  if (!sessionId && !initialGoal) {
    return new Response("sessionId or initialGoal required", { status: 400 });
  }

  // 动态导入避免模块顶层副作用
  const { createInterviewAgent } = await import(
    "@/features/learning/agent/interview-agent"
  );
  const { createInterviewSession, getInterviewSession } = await import(
    "@/features/learning/services/interview-session"
  );

  // 获取或创建 session
  let sid = sessionId;
  if (!sid) {
    sid = await createInterviewSession(userId, initialGoal!);
  } else {
    // 验证 session 归属
    await getInterviewSession(sid, userId);
  }

  const agent = createInterviewAgent(sid);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    options: { userId, sessionId: sid },
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    }),
  });
}
```

同时需要在 response header 中返回 sessionId 给客户端（首次创建时）。修改为：

```typescript
const response = createAgentUIStreamResponse({
  agent,
  uiMessages: messages,
  options: { userId, sessionId: sid },
  experimental_transform: smoothStream({
    chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
  }),
});

// 将 sessionId 通过 header 传回客户端（首次创建场景）
response.headers.set("X-Session-Id", sid);
return response;
```

**Step 2: 新建 interview session 恢复 API**

创建 `apps/web/app/api/interview/[id]/route.ts`:

```typescript
import { auth } from "@/auth";
import { getInterviewSession } from "@/features/learning/services/interview-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    const interviewSession = await getInterviewSession(id, session.user.id);
    return Response.json({
      id: interviewSession.id,
      status: interviewSession.status,
      profile: interviewSession.profile,
      messages: interviewSession.messages,
      proposedOutline: interviewSession.proposedOutline,
      confirmedOutline: interviewSession.confirmedOutline,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
```

**Step 3: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 4: 提交**

```bash
git add apps/web/app/api/chat/route.ts apps/web/app/api/interview/
git commit -m "feat(api): support sessionId in interview route + add session restore endpoint"
```

---

## Task 7: 前端 Hook — useInterview

**文件:**
- 新建: `apps/web/features/learning/hooks/useInterview.ts`

**Step 1: 创建 useInterview.ts**

```typescript
import { useChat } from "@ai-sdk/react";
import { isToolUIPart, getToolName } from "ai";
import { useCallback, useRef, useState } from "react";
import type { InterviewAgentMessage } from "@/features/learning/agent/interview-agent";
import type { InterviewPhase } from "@/features/learning/types";
import { findToolCall } from "@/features/shared/ai/ui-utils";

interface UseInterviewOptions {
  initialGoal: string;
  sessionId?: string;
  initialMessages?: Parameters<typeof useChat>[0] extends { initialMessages?: infer M } ? M : never;
}

export function useInterview({
  initialGoal,
  sessionId: initialSessionId,
  initialMessages,
}: UseInterviewOptions) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? null);
  const [phase, setPhase] = useState<InterviewPhase>("interviewing");
  const [input, setInput] = useState("");
  const hasStartedRef = useRef(false);

  const {
    messages,
    sendMessage,
    addToolOutput,
    status,
    error,
    stop,
  } = useChat<InterviewAgentMessage>({
    body: {
      explicitIntent: "INTERVIEW",
      sessionId,
      initialGoal: !sessionId ? initialGoal : undefined,
    },
    initialMessages,
    onResponse: (response) => {
      // 首次创建时从 header 读取 sessionId
      const sid = response.headers.get("X-Session-Id");
      if (sid && !sessionId) {
        setSessionId(sid);
      }
    },
  } as Parameters<typeof useChat<InterviewAgentMessage>>[0]);

  const isLoading = status === "streaming" || status === "submitted";

  // ─── 自动启动 ───
  // 首次渲染且没有历史消息时，发送初始目标
  if (!hasStartedRef.current && messages.length === 0 && initialGoal) {
    hasStartedRef.current = true;
    // 用 setTimeout 避免在 render 中调用
    setTimeout(() => sendMessage({ text: initialGoal }), 0);
  }

  // ─── 检测 proposeOutline ───
  const lastMsg = messages.at(-1);
  const proposeOutlineTool = lastMsg?.role === "assistant"
    ? findToolCall(lastMsg, "proposeOutline")
    : null;

  if (proposeOutlineTool?.state === "input-available" && phase === "interviewing") {
    setPhase("proposing");
  }

  // ─── 选项点击 ───
  const handleOptionSelect = useCallback(
    (toolCallId: string, selected: string) => {
      (addToolOutput as Function)({
        toolCallId,
        output: { selected },
      });
    },
    [addToolOutput],
  );

  // ─── 发送消息（打字或选项） ───
  const handleSendMessage = useCallback(
    (e?: React.FormEvent, overrideInput?: string) => {
      e?.preventDefault();
      const text = overrideInput ?? input;
      if (!text.trim()) return;
      if (!overrideInput) setInput("");

      // 检查是否有 pending 的 client-side tool
      const last = messages.at(-1);
      if (last?.role === "assistant") {
        const pendingSuggest = findToolCall(last, "suggestOptions");
        if (pendingSuggest?.state === "input-available") {
          (addToolOutput as Function)({
            toolCallId: pendingSuggest.toolCallId,
            output: { selected: text },
          });
          return;
        }
      }

      sendMessage({ text });
    },
    [input, messages, addToolOutput, sendMessage],
  );

  // ─── 确认大纲 ───
  const handleConfirmOutline = useCallback(() => {
    if (!proposeOutlineTool) return;
    (addToolOutput as Function)({
      toolCallId: proposeOutlineTool.toolCallId,
      output: { action: "confirm" },
    });
    setPhase("reviewing");
  }, [proposeOutlineTool, addToolOutput]);

  // ─── 调整（继续对话） ───
  const handleAdjustOutline = useCallback(
    (feedback: string) => {
      if (!proposeOutlineTool) return;
      (addToolOutput as Function)({
        toolCallId: proposeOutlineTool.toolCallId,
        output: { action: "adjust", feedback },
      });
      setPhase("interviewing");
    },
    [proposeOutlineTool, addToolOutput],
  );

  return {
    // 状态
    sessionId,
    phase,
    messages,
    isLoading,
    error: error?.message,
    input,
    setInput,

    // 操作
    handleSendMessage,
    handleOptionSelect,
    handleConfirmOutline,
    handleAdjustOutline,
    stop,

    // proposeOutline 数据（用于渲染确认 UI）
    proposedOutline: proposeOutlineTool?.state === "input-available"
      ? (proposeOutlineTool.input as { summary: string; suggestedTitle: string })
      : null,
  };
}
```

**Step 2: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 3: 提交**

```bash
git add apps/web/features/learning/hooks/useInterview.ts
git commit -m "feat(hooks): add useInterview hook with server-side session and adaptive conversation"
```

---

## Task 8: 前端 — ChatInterface 适配

**文件:**
- 修改: `apps/web/features/learning/components/create/ChatInterface.tsx`

**Step 1: 适配新的 phase 和 hook 接口**

这个 Task 主要是将 ChatInterface 从旧的 `useCourseGeneration` 接口迁移到新的 `useInterview` 接口。UI 样式沿用，接口改变:

- `phase` 类型从旧的 7 个改为新的 5 个
- 新增 `proposedOutline` prop 用于渲染确认 UI
- 新增 `onConfirmOutline` 和 `onAdjustOutline` 回调
- 移除 `interviewContext` prop（不再需要，服务端管理）

具体代码变更参见 design doc。这里不展开完整 UI 代码，因为样式沿用现有。

**Step 2: 类型检查 + 手动验证**

```bash
pnpm --filter @nexusnote/web typecheck
pnpm --filter @nexusnote/web dev
```

浏览器打开，测试 interview 对话流程。

**Step 3: 提交**

```bash
git add apps/web/features/learning/components/
git commit -m "feat(ui): adapt ChatInterface to new interview phases and propose outline flow"
```

---

## Task 9: BullMQ — 队列配置 + Worker

**文件:**
- 新建: `apps/web/lib/queue/index.ts`
- 新建: `apps/web/lib/queue/course-worker.ts`

**Step 1: 安装 BullMQ**

```bash
cd /Users/findbiao/projects/nexusnote
pnpm --filter @nexusnote/web add bullmq
```

**Step 2: 创建队列配置 `lib/queue/index.ts`**

```typescript
import { Queue } from "bullmq";
import { env } from "@nexusnote/config";

const connection = {
  host: new URL(env.REDIS_URL || "redis://localhost:6379").hostname,
  port: Number(new URL(env.REDIS_URL || "redis://localhost:6379").port) || 6379,
};

export const courseQueue = new Queue("course-generation", { connection });
```

**Step 3: 创建 Worker `lib/queue/course-worker.ts`**

```typescript
import { Worker } from "bullmq";
import { env } from "@nexusnote/config";
import { courseGenerationAgent } from "@/features/learning/agents/course-generation/agent";
import { db, courseProfiles, eq } from "@nexusnote/db";

const connection = {
  host: new URL(env.REDIS_URL || "redis://localhost:6379").hostname,
  port: Number(new URL(env.REDIS_URL || "redis://localhost:6379").port) || 6379,
};

interface CourseJobData {
  courseId: string;
  sessionId: string;
  userId: string;
}

const worker = new Worker<CourseJobData>(
  "course-generation",
  async (job) => {
    const { courseId, userId } = job.data;

    const profile = await db.query.courseProfiles.findFirst({
      where: eq(courseProfiles.id, courseId),
    });

    if (!profile) throw new Error(`Course ${courseId} not found`);

    const outline = profile.outlineData as Record<string, unknown>;
    const modules = (outline.modules as Array<{ chapters: Array<{ title: string }> }>) || [];
    const chapters = modules.flatMap((m) => m.chapters);

    for (let i = 0; i < chapters.length; i++) {
      await job.updateProgress({
        current: i,
        total: chapters.length,
        status: "generating",
        chapterTitle: chapters[i].title,
      });

      await courseGenerationAgent.generate({
        prompt: `请生成第 ${i + 1} 章的内容: ${chapters[i].title}`,
        options: {
          id: courseId,
          userId,
          goal: profile.goal,
          background: profile.background,
          targetOutcome: profile.targetOutcome,
          cognitiveStyle: profile.cognitiveStyle,
          outlineTitle: profile.title,
          outlineData: outline,
          moduleCount: modules.length,
          totalChapters: chapters.length,
          currentModuleIndex: 0,
          currentChapterIndex: i,
          chaptersGenerated: i,
        },
      });
    }

    await job.updateProgress({
      current: chapters.length,
      total: chapters.length,
      status: "completed",
    });

    return { completed: true, chapters: chapters.length };
  },
  {
    connection,
    concurrency: 1,
    limiter: { max: 2, duration: 60_000 },
  },
);

worker.on("failed", (job, err) => {
  console.error(`[CourseWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[CourseWorker] Job ${job.id} completed`);
});

export { worker };
```

**Step 4: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 5: 提交**

```bash
git add apps/web/lib/queue/
git commit -m "feat(queue): add BullMQ course generation queue and worker"
```

---

## Task 10: API — 课程创建 + SSE 进度

**文件:**
- 新建: `apps/web/app/api/course/create/route.ts`
- 新建: `apps/web/app/api/course/[id]/progress/route.ts`

**Step 1: 创建课程触发 API**

`apps/web/app/api/course/create/route.ts`:

```typescript
import { auth } from "@/auth";
import { confirmOutline } from "@/features/learning/services/interview-session";
import { saveCourseProfile } from "@/features/learning/agents/course-profile";
import { getInterviewSession } from "@/features/learning/services/interview-session";
import { courseQueue } from "@/lib/queue";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId } = (await request.json()) as { sessionId: string };
  const userId = session.user.id;

  // 确认大纲
  await confirmOutline(sessionId);
  const interviewSession = await getInterviewSession(sessionId, userId);
  const outline = interviewSession.confirmedOutline as Record<string, unknown>;
  const profile = interviewSession.profile as Record<string, unknown>;

  // 创建 courseProfile 记录
  const courseId = await saveCourseProfile({
    userId,
    goal: (profile.goal as string) || interviewSession.initialGoal,
    background: (profile.background as string) || "",
    targetOutcome: (profile.targetOutcome as string) || "",
    cognitiveStyle: (profile.preferences as string) || "",
    outlineData: outline as Parameters<typeof saveCourseProfile>[0]["outlineData"],
    designReason: "S-tier Interview Engine 个性化设计",
  });

  // 入队 BullMQ 任务
  await courseQueue.add("generate", {
    courseId,
    sessionId,
    userId,
  }, {
    jobId: courseId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });

  return Response.json({ courseId });
}
```

**Step 2: 创建 SSE 进度 API**

`apps/web/app/api/course/[id]/progress/route.ts`:

```typescript
import { auth } from "@/auth";
import { courseQueue } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: courseId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // stream may be closed
        }
      };

      const job = await courseQueue.getJob(courseId);
      if (!job) {
        send({ status: "not_found" });
        controller.close();
        return;
      }

      const poll = setInterval(async () => {
        try {
          const progress = job.progress as Record<string, unknown>;
          const state = await job.getState();

          send({ progress, state });

          if (state === "completed" || state === "failed") {
            clearInterval(poll);
            send({ status: state, result: state === "completed" ? job.returnvalue : null });
            controller.close();
          }
        } catch {
          clearInterval(poll);
          controller.close();
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Step 3: 类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 4: 提交**

```bash
git add apps/web/app/api/course/
git commit -m "feat(api): add course creation with BullMQ and SSE progress endpoint"
```

---

## Task 11: 前端 Hook — useCourseProgress

**文件:**
- 新建: `apps/web/features/learning/hooks/useCourseProgress.ts`

**Step 1: 创建 useCourseProgress.ts**

```typescript
import { useEffect, useState } from "react";

interface CourseProgress {
  current: number;
  total: number;
  status: "generating" | "completed" | "failed" | "not_found";
  chapterTitle?: string;
}

export function useCourseProgress(courseId: string | null) {
  const [progress, setProgress] = useState<CourseProgress | null>(null);

  useEffect(() => {
    if (!courseId) return;

    const eventSource = new EventSource(`/api/course/${courseId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress) {
          setProgress(data.progress);
        }
        if (data.status === "completed" || data.status === "failed") {
          setProgress((prev) => prev ? { ...prev, status: data.status } : null);
          eventSource.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [courseId]);

  return progress;
}
```

**Step 2: 提交**

```bash
git add apps/web/features/learning/hooks/useCourseProgress.ts
git commit -m "feat(hooks): add useCourseProgress hook with SSE subscription"
```

---

## Task 12: 清理 — 移除旧代码 + 修复引用

**文件:**
- 删除: `apps/web/features/learning/agents/interview/agent.ts` (如果存在)
- 删除: `apps/web/features/learning/tools/interview.ts` (如果存在)
- 修改: `apps/web/features/learning/index.ts` (更新导出)
- 修改: `apps/web/lib/ai/agents/index.ts` (更新导出)
- 修改: 所有引用旧 `InterviewContextSchema` 的文件

**Step 1: 删除旧文件**

```bash
rm -f apps/web/features/learning/agents/interview/agent.ts
rm -f apps/web/features/learning/tools/interview.ts
```

**Step 2: 修复所有引用**

搜索所有引用旧导出的文件并更新:

```bash
cd /Users/findbiao/projects/nexusnote
grep -r "InterviewContextSchema\|InterviewContext\b" apps/web/ --include="*.ts" --include="*.tsx" -l
```

逐个修复 import 路径。`InterviewContext` 类型不再需要——服务端用 `LearnerProfile`，前端不需要知道具体结构。

**Step 3: 全量类型检查**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 4: 提交**

```bash
git add -A
git commit -m "refactor: remove old interview agent code and fix all references"
```

---

## Task 13: 集成验证

**Step 1: 本地启动全栈**

```bash
pnpm dev
```

**Step 2: 手动测试流程**

1. 打开课程创建页面，输入"学炒西红柿"
2. 验证：AI 快速对话（1-3 轮），动态选项贴合话题
3. 验证：AI 调用 proposeOutline 时显示确认 UI
4. 输入"学量子计算"
5. 验证：AI 深入追问（5+ 轮），选项跟领域相关
6. 验证：刷新页面后对话恢复（从 DB 读取）
7. 确认大纲 → 验证 BullMQ job 入队
8. 验证 SSE 进度推送到前端

**Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete S-tier interview engine with adaptive conversation and BullMQ generation"
```

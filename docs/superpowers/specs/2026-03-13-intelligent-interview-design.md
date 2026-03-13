# Intelligent Interview Design Spec

## Goal

Replace the rigid 3-indicator FSM interview flow with a prompt-driven, model-autonomous interview. The AI model freely conducts a natural conversation to understand the user's learning needs, then generates a rich personalized course outline when it judges it has enough information.

## Architecture

Remove `computePhase`, `InterviewState`, `InterviewPhase`, `getPhasePrompt`, and the `updateProfile` tool entirely. The `ToolLoopAgent` receives a single static `instructions` prompt (no `prepareCall`, no DB reads per step). The only tool is `confirmOutline` with an enriched schema. The frontend monitors `confirmOutline` output via `isToolUIPart` / `getToolName` type guards from AI SDK v6.

## What Changes

### Deleted

| File | What | Why |
|------|------|-----|
| `lib/ai/schemas/interview.ts` | Entire file (`computePhase`, `InterviewState`, `InterviewPhase`, `isProfileComplete`) | No FSM needed |
| `lib/ai/prompts/interview.ts` | `getPhasePrompt` function | No phase-based prompt switching |
| `lib/ai/tools/interview/index.ts` | `updateProfile` tool, `UpdateProfileSchema`, `UpdateProfileOutput` | AI doesn't manage state; model works from conversation context |
| `stores/interview.ts` | `InterviewProfileState`, `profile`, `setProfile`, `LearningLevel` | No structured profile to store |
| `hooks/useInterview.ts` | `updateProfile` monitoring logic, `UpdateProfileOutput` type, manual `isToolPart` function | Replaced by `confirmOutline`-only monitoring with official type guards |
| `db/schema.ts` | `InterviewProfile` interface, `LearningLevel` type | No longer used (DB column `interviewProfile` becomes unused) |

### Modified

| File | What Changes |
|------|-------------|
| `lib/ai/prompts/interview.ts` | `INTERVIEW_PROMPT` rewritten: describes what a good interview looks like, not a fixed collection sequence |
| `lib/ai/tools/interview/index.ts` | `ConfirmOutlineSchema` enriched with new fields; `createInterviewTools` only returns `confirmOutline` |
| `lib/ai/agents/interview.ts` | Remove `prepareCall`, DB imports, state generics; pass `instructions` directly to `ToolLoopAgent` |
| `lib/ai/agents/interview.ts` | `InterviewAgentOptions` simplified to `{ userId, courseId, messages? }` |
| `hooks/useInterview.ts` | Use `isToolUIPart` + `getToolName` from 'ai'; only monitor `confirmOutline`; update `OutlineData` type |
| `stores/interview.ts` | `OutlineData` updated to match new `ConfirmOutlineSchema`; remove profile-related state |
| `app/interview/page.tsx` | Remove profile progress indicator; keep round counter; update `OutlinePanel` props for new outline shape |
| `app/api/interview/route.ts` | `resolveInterviewState` simplified further (no profile concerns); remove `InterviewProfile` import |
| `lib/ai/tools/index.ts` | `buildAgentTools("interview", ctx)` returns only `confirmOutline` + shared tools |

### Not Changed

- Frontend layout (left outline panel + right chat)
- `useChat` + `DefaultChatTransport` + AI SDK transport layer
- `createNexusNoteStreamResponse` streaming
- DB table `courseSessions` (schema unchanged, `interviewProfile` column just unused)
- Chat/Course agents (unrelated)

## New Interview Prompt

```
你是 NexusNote 的课程规划师。通过自然对话深入了解用户的学习需求，然后生成高质量的个性化课程大纲。

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

像朋友聊天，简洁自然，每轮只问一个问题。
```

## New ConfirmOutline Schema

```typescript
const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().describe("一句话课程描述"),
  targetAudience: z.string().describe("适合谁学"),
  prerequisites: z.array(z.string()).optional().describe("前置知识要求"),
  estimatedHours: z.number().describe("预计总学时（小时）"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("整体难度"),
  chapters: z.array(z.object({
    title: z.string().describe("章节标题"),
    description: z.string().describe("章节简介"),
    topics: z.array(z.string()).describe("知识点列表"),
    estimatedMinutes: z.number().optional().describe("预计学习时长（分钟）"),
    practiceType: z.enum(["exercise", "project", "quiz", "none"]).optional().describe("实践类型"),
  })).min(1).describe("章节列表"),
  learningOutcome: z.string().describe("学完能做什么"),
});
```

New fields vs old: `targetAudience`, `prerequisites`, `learningOutcome`, per-chapter `estimatedMinutes` and `practiceType`. Top-level time changed from `estimatedMinutes` to `estimatedHours`.

## New Agent Construction

```typescript
export function createInterviewAgent(options: InterviewAgentOptions) {
  const ctx = createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });

  const tools = buildAgentTools("interview", ctx);

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    instructions: INTERVIEW_PROMPT,
    tools,
    stopWhen: stepCountIs(15),
  });
}
```

No `prepareCall`, no state type, no DB reads, no `toolChoice` forcing.

## Data Flow

```
User message
  → /api/interview (resolve courseId)
  → createInterviewAgent (static prompt, only confirmOutline tool)
  → ToolLoopAgent natural conversation
  → Model judges info sufficient → calls confirmOutline
  → Tool writes DB (outlineData, title, status)
  → Tool result streams to frontend
  → useInterview detects confirmOutline via isToolUIPart + getToolName
  → Store updates outline + interviewCompleted
  → OutlinePanel slides in
  → User can continue chatting to modify outline
  → Model calls confirmOutline again with updated outline
```

## Frontend Hook Changes

```typescript
// Before: manual type guard + monitor both tools
function isToolPart(part) { return part.type.startsWith("tool-"); }
// monitor updateProfile AND confirmOutline

// After: official type guards + monitor only confirmOutline
import { isToolUIPart, getToolName } from 'ai';
// monitor only confirmOutline
const confirmPart = msg.parts?.find(
  p => isToolUIPart(p) && getToolName(p) === "confirmOutline" && p.state === "output-available"
);
```

## Store Changes

```typescript
// Before
interface InterviewStore {
  profile: InterviewProfileState;  // REMOVED
  outline: OutlineData | null;
  courseId: string | null;
  isOutlineLoading: boolean;
  interviewCompleted: boolean;
  setProfile: ...;  // REMOVED
  // ...
}

// After
interface InterviewStore {
  outline: OutlineData | null;  // OutlineData type updated
  courseId: string | null;
  isOutlineLoading: boolean;
  interviewCompleted: boolean;
  // ...
}
```

## OutlineData Type (matches new schema)

```typescript
interface Chapter {
  title: string;
  description: string;
  topics: string[];
  estimatedMinutes?: number;
  practiceType?: "exercise" | "project" | "quiz" | "none";
}

interface OutlineData {
  title: string;
  description: string;
  targetAudience: string;
  prerequisites?: string[];
  estimatedHours: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  chapters: Chapter[];
  learningOutcome: string;
}
```

## Risk & Rollback

- DB schema unchanged (just stops writing to `interviewProfile` column). Zero migration risk.
- Old `interviewProfile` data remains in DB, harmless.
- If model quality is poor (generates outlines too early/late), fix by tuning the prompt — no code changes needed.

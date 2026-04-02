# AI SDK v6 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 将 NexusNote AI 系统重构为 AI SDK v6 最佳实践架构

**Architecture:** 创建 `lib/ai/core/` 核心模块，统一 ToolContext 工厂模式，Agent 泛型状态机，嵌套 AI 超时封装，流式错误 Graceful 降级

**Tech Stack:** AI SDK v6.0.94, TypeScript, Zod, Drizzle ORM

---

## Task 1: 创建 core 目录和 ToolContext

**Files:**
- Create: `lib/ai/core/tool-context.ts`
- Create: `lib/ai/core/index.ts`

**Step 1: 创建 tool-context.ts**

```typescript
// lib/ai/core/tool-context.ts

import type { UIMessage } from "ai";

/**
 * 工具上下文
 * userId 是权限边界，必填
 */
export interface ToolContext {
  /** 用户 ID - 必填，权限边界 */
  userId: string;

  /** 会话 ID - 可选 */
  sessionId?: string;

  /** 资源 ID - 可选（如 courseId, documentId） */
  resourceId?: string;

  /** 当前消息列表 - 可选 */
  messages?: UIMessage[];
}

/**
 * 工具工厂函数类型
 */
export type ToolFactory<T = Record<string, unknown>> = (ctx: ToolContext) => T;

/**
 * 创建工具上下文（带验证）
 */
export function createToolContext(input: {
  userId: string | undefined | null;
  sessionId?: string;
  resourceId?: string;
  messages?: UIMessage[];
}): ToolContext {
  if (!input.userId) {
    throw new Error("ToolContext requires userId");
  }
  return {
    userId: input.userId,
    sessionId: input.sessionId,
    resourceId: input.resourceId,
    messages: input.messages,
  };
}
```

**Step 2: 创建 core/index.ts 导出**

```typescript
// lib/ai/core/index.ts

export * from "./tool-context";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors related to new files

**Step 4: Commit**

```bash
git add lib/ai/core/
git commit -m "feat(ai): add ToolContext and tool factory pattern"
```

---

## Task 2: 创建 nested-ai.ts 封装

**Files:**
- Create: `lib/ai/core/nested-ai.ts`
- Modify: `lib/ai/core/index.ts`

**Step 1: 创建 nested-ai.ts**

```typescript
// lib/ai/core/nested-ai.ts

import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { aiProvider } from "../core";

// ============================================
// Types
// ============================================

export interface NestedAIOptions {
  /** 超时时间，默认 30 秒 */
  timeout?: number;
  /** 温度，默认 0.3 */
  temperature?: number;
  /** 使用 Pro 模型，默认 false */
  useProModel?: boolean;
}

export interface NestedAIResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  durationMs: number;
}

// ============================================
// Core Function
// ============================================

/**
 * 嵌套 AI 调用封装
 *
 * 统一处理：
 * - 超时控制
 * - 错误处理
 * - 日志记录
 */
export async function callNestedAI<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: NestedAIOptions = {},
): Promise<NestedAIResult<T>> {
  const startTime = Date.now();
  const { timeout = 30_000, temperature = 0.3, useProModel = false } = options;

  const model = useProModel ? aiProvider.proModel : aiProvider.chatModel;

  if (!model) {
    return {
      success: false,
      data: null,
      error: "AI 模型未配置",
      durationMs: 0,
    };
  }

  try {
    const result = await generateText({
      model,
      prompt,
      temperature,
      timeout,
      output: Output.object({ schema }),
    });

    const durationMs = Date.now() - startTime;
    console.log("[NestedAI] Success", { durationMs });

    return {
      success: true,
      data: result.output as T,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[NestedAI] Error:", errorMessage, { durationMs });

    return {
      success: false,
      data: null,
      error: errorMessage,
      durationMs,
    };
  }
}
```

**Step 2: 更新 core/index.ts 导出**

```typescript
// lib/ai/core/index.ts

export * from "./tool-context";
export * from "./nested-ai";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/ai/core/
git commit -m "feat(ai): add callNestedAI wrapper with timeout support"
```

---

## Task 3: 创建 streaming.ts 错误处理

**Files:**
- Create: `lib/ai/core/streaming.ts`
- Modify: `lib/ai/core/index.ts`

**Step 1: 创建 streaming.ts**

```typescript
// lib/ai/core/streaming.ts

import {
  createAgentUIStreamResponse,
  smoothStream,
  type UIMessage,
} from "ai";

// ============================================
// Types
// ============================================

type AnyAgent = Parameters<typeof createAgentUIStreamResponse>[0]["agent"];

export interface StreamOptions {
  /** 会话 ID */
  sessionId?: string;
  /** 资源 ID */
  resourceId?: string;
}

// ============================================
// Fallback Messages
// ============================================

const FALLBACK_MESSAGES = {
  timeout: "抱歉，AI 响应超时，请稍后重试。",
  rate_limit: "请求过于频繁，请稍后再试。",
  model_error: "AI 模型暂时不可用，请稍后重试。",
  unknown: "抱歉，AI 服务出现异常，请稍后重试。",
};

function getFallbackMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) {
      return FALLBACK_MESSAGES.timeout;
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return FALLBACK_MESSAGES.rate_limit;
    }
    if (message.includes("model") || message.includes("503")) {
      return FALLBACK_MESSAGES.model_error;
    }
  }
  return FALLBACK_MESSAGES.unknown;
}

// ============================================
// Fallback Stream
// ============================================

function createFallbackStream(
  message: string,
  headers: { sessionId?: string; resourceId?: string },
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const char of message) {
        controller.enqueue(encoder.encode(`0:"${char}"\n`));
      }
      controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
      controller.close();
    },
  });

  const response = new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Stream-Error": "true",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });

  if (headers.sessionId) response.headers.set("X-Session-Id", headers.sessionId);
  if (headers.resourceId) response.headers.set("X-Resource-Id", headers.resourceId);

  return response;
}

// ============================================
// Main Function
// ============================================

/**
 * 创建 NexusNote 流式响应
 *
 * 特性：
 * - 中文流式分词优化
 * - 错误时 Graceful 降级
 * - 自动添加响应头
 */
export async function createNexusNoteStreamResponse(
  agent: AnyAgent,
  messages: UIMessage[],
  options: StreamOptions = {},
): Promise<Response> {
  const { sessionId, resourceId } = options;

  try {
    const response = await createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
    });

    if (sessionId) response.headers.set("X-Session-Id", sessionId);
    if (resourceId) response.headers.set("X-Resource-Id", resourceId);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return response;
  } catch (error) {
    console.error("[Streaming] Error:", error);

    return createFallbackStream(getFallbackMessage(error), { sessionId, resourceId });
  }
}
```

**Step 2: 更新 core/index.ts 导出**

```typescript
// lib/ai/core/index.ts

export * from "./tool-context";
export * from "./nested-ai";
export * from "./streaming";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/ai/core/
git commit -m "feat(ai): add streaming with graceful degradation"
```

---

## Task 4: 创建 schemas 目录和 InterviewState

**Files:**
- Create: `lib/ai/schemas/interview.ts`
- Create: `lib/ai/schemas/index.ts`

**Step 1: 创建 schemas/interview.ts**

```typescript
// lib/ai/schemas/interview.ts

import { z } from "zod";

/**
 * 访谈阶段
 */
export const InterviewPhaseSchema = z.enum([
  "collecting_goal",
  "collecting_background",
  "collecting_time",
  "collecting_outcome",
  "ready",
  "completed",
]);

export type InterviewPhase = z.infer<typeof InterviewPhaseSchema>;

/**
 * 访谈状态 - 前端传递给 Agent
 */
export const InterviewStateSchema = z.object({
  goal: z.string().optional(),
  background: z.enum(["none", "beginner", "intermediate", "advanced"]).optional(),
  timeCommitment: z.enum(["casual", "moderate", "intensive"]).optional(),
  outcome: z.string().optional(),
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;

/**
 * 计算当前阶段
 */
export function computePhase(state: InterviewState): InterviewPhase {
  if (!state.goal) return "collecting_goal";
  if (!state.background) return "collecting_background";
  if (!state.timeCommitment) return "collecting_time";
  if (!state.outcome) return "collecting_outcome";
  return "ready";
}
```

**Step 2: 创建 schemas/index.ts**

```typescript
// lib/ai/schemas/index.ts

export * from "./interview";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/ai/schemas/
git commit -m "feat(ai): add InterviewState schema and phase computation"
```

---

## Task 5: 创建 prompts 目录

**Files:**
- Create: `lib/ai/prompts/chat.ts`
- Create: `lib/ai/prompts/interview.ts`
- Create: `lib/ai/prompts/index.ts`

**Step 1: 创建 prompts/chat.ts**

```typescript
// lib/ai/prompts/chat.ts

import type { InterviewState, InterviewPhase } from "@/lib/ai/schemas/interview";

export const CHAT_PROMPT = `你是 NexusNote 智能助手。

## 核心能力

- 搜索和管理用户的笔记、对话、课程、闪卡
- 创建/编辑/删除笔记
- 生成思维导图和摘要
- 互联网搜索

## 行为准则

- 主动、简洁、有益
- 需要用户确认的操作（如删除）必须先询问
- 使用工具获取信息，不要编造`;

/**
 * 构建个性化指令
 */
export function buildInstructions(
  basePrompt: string,
  personalization?: { personaPrompt?: string; userContext?: string },
): string {
  const parts = [
    personalization?.personaPrompt,
    personalization?.userContext,
    basePrompt,
  ].filter(Boolean);

  return parts.join("\n\n");
}
```

**Step 2: 创建 prompts/interview.ts**

```typescript
// lib/ai/prompts/interview.ts

import type { InterviewState, InterviewPhase } from "@/lib/ai/schemas/interview";

export const INTERVIEW_PROMPT = `你是 NexusNote 的课程规划师。

## 工具说明

- suggestOptions: 向用户展示选项卡片，用于收集信息
- confirmOutline: 生成课程大纲（信息收集完成后调用）

## 工作流程

1. 自然对话了解用户需求
2. 每轮结束时调用 suggestOptions 展示选项
3. 信息收集完成后调用 confirmOutline 生成大纲

## 核心规则

1. 每轮只问一个问题
2. 提问后调用 suggestOptions
3. 像朋友聊天，简洁自然`;

/**
 * 构建进度指示器
 */
function buildProgressIndicator(state: InterviewState): string {
  const items = [
    state.goal ? `✅ 学习目标: ${state.goal}` : "⏳ 学习目标（待确认）",
    state.background ? `✅ 基础水平: ${state.background}` : "⏳ 基础水平（待确认）",
    state.timeCommitment ? `✅ 时间投入: ${state.timeCommitment}` : "⏳ 时间投入（待确认）",
    state.outcome ? `✅ 期望成果: ${state.outcome}` : "⏳ 期望成果（待确认）",
  ];

  return `## 📊 收集进度\n\n${items.join("\n")}`;
}

/**
 * 根据阶段生成动态 Prompt
 */
export function getPhasePrompt(phase: InterviewPhase, state: InterviewState): string {
  const progress = buildProgressIndicator(state);

  if (phase === "ready") {
    return `${progress}

现在可以生成课程大纲了。调用 confirmOutline 工具。`;
  }

  const missing: string[] = [];
  if (!state.goal) missing.push("学习目标");
  if (!state.background) missing.push("基础水平");
  if (!state.timeCommitment) missing.push("时间投入");
  if (!state.outcome) missing.push("期望成果");

  return `${progress}

还需要了解：${missing.join("、")}
继续对话，然后调用 suggestOptions。`;
}
```

**Step 3: 创建 prompts/index.ts**

```typescript
// lib/ai/prompts/index.ts

export * from "./chat";
export * from "./interview";
```

**Step 4: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add lib/ai/prompts/
git commit -m "feat(ai): add chat and interview prompts"
```

---

## Task 6: 创建 suggestOptions 通用工具

**Files:**
- Create: `lib/ai/tools/shared/suggest-options.ts`
- Create: `lib/ai/tools/shared/index.ts`

**Step 1: 创建 suggest-options.ts**

```typescript
// lib/ai/tools/shared/suggest-options.ts

import { tool } from "ai";
import { z } from "zod";

/**
 * 通用选项建议工具
 *
 * 所有 Agent 都可以使用，用于：
 * - 给用户提供快速回复选项
 * - 降低用户输入成本
 * - 引导对话方向
 *
 * 用户不是必须选择，可以直接对话
 */
export const suggestOptionsTool = tool({
  description: `根据对话上下文，预测用户最可能的意图，显示为快捷操作。

核心原则：
- 意图 = 用户想做的事/想了解的信息
- 专业干练，禁止口语化

示例：
用户：我想学 React
AI：你的编程基础怎么样？
→ suggestOptions({ options: ["零基础入门", "HTML/CSS 基础", "JavaScript 基础", "有前端经验"] })

用户：这个课程要多久？
AI：大约需要 20 小时
→ suggestOptions({ options: ["开始学习", "查看大纲", "试听课程", "学习计划"] })`,

  inputSchema: z.object({
    options: z.array(z.string()).min(2).max(5)
      .describe("用户最可能的意图，专业干练，2-4个"),
  }),

  execute: async ({ options }) => ({
    success: true,
    options,
  }),
});
```

**Step 2: 创建 shared/index.ts**

```typescript
// lib/ai/tools/shared/index.ts

export * from "./suggest-options";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/ai/tools/shared/
git commit -m "feat(ai): add suggestOptions tool for all agents"
```

---

## Task 7: 重构 tools/index.ts 添加 buildAgentTools

**Files:**
- Modify: `lib/ai/tools/index.ts`

**Step 1: 查看当前 tools/index.ts 内容**

Run: `cat lib/ai/tools/index.ts`

**Step 2: 添加 buildAgentTools 函数**

在现有导出后添加：

```typescript
// lib/ai/tools/index.ts

// 现有导出保持不变
export * from "./chat";
export * from "./editor";
export * from "./interview";
export * from "./learning";
export * from "./rag";
export * from "./skills";
export * from "./shared";

// 新增：工具构建器
import type { ToolContext } from "@/lib/ai/core/tool-context";
import { createNoteTools } from "./chat/notes";
import { createSearchTools } from "./chat/search";
import { createRagTools } from "./rag";
import { createInterviewTools } from "./interview";
import { createCourseTools } from "./learning/course";
import { createDiscoverSkillsTool } from "./skills/discovery";
import { suggestOptionsTool } from "./shared/suggest-options";
import { webSearchTool } from "./chat/web-search";
import { mindMapTool, summarizeTool } from "./learning/enhance";
import { editDocumentTool, batchEditTool, draftContentTool } from "./editor";

/**
 * 工具注册表
 */
export const toolRegistry = {
  global: {
    search: createSearchTools,
    rag: createRagTools,
    notes: createNoteTools,
  },
  resource: {
    interview: createInterviewTools,
    course: createCourseTools,
  },
  shared: {
    suggestOptions: suggestOptionsTool,
    webSearch: webSearchTool,
    mindMap: mindMapTool,
    summarize: summarizeTool,
    editDocument: editDocumentTool,
    batchEdit: batchEditTool,
    draftContent: draftContentTool,
  },
  skills: {
    discoverSkills: createDiscoverSkillsTool,
  },
} as const;

/**
 * 为 Agent 构建工具集
 */
export function buildAgentTools(
  agentType: "chat" | "interview" | "course" | "skills",
  ctx: ToolContext,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};

  // 共享工具 - 所有 Agent 都有
  Object.assign(tools, toolRegistry.shared);

  // 全局工具
  Object.assign(tools, toolRegistry.global.search(ctx));
  Object.assign(tools, toolRegistry.global.rag(ctx));

  switch (agentType) {
    case "chat":
      Object.assign(tools, toolRegistry.global.notes(ctx));
      break;

    case "interview":
      if (!ctx.resourceId) {
        throw new Error("Interview agent requires resourceId (courseId)");
      }
      Object.assign(tools, toolRegistry.resource.interview(ctx));
      break;

    case "course":
      if (!ctx.resourceId) {
        throw new Error("Course agent requires resourceId (courseId)");
      }
      Object.assign(tools, toolRegistry.resource.course(ctx));
      break;

    case "skills":
      Object.assign(tools, toolRegistry.skills.discoverSkills(ctx.userId));
      break;
  }

  return tools;
}
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/ai/tools/index.ts
git commit -m "feat(ai): add buildAgentTools and toolRegistry"
```

---

## Task 8: 重构 Interview Agent 添加状态机

**Files:**
- Modify: `lib/ai/tools/interview/index.ts`
- Modify: `lib/ai/agents/interview.ts`

**Step 1: 简化 interview tools 为 1 个**

修改 `lib/ai/tools/interview/index.ts`：

```typescript
// lib/ai/tools/interview/index.ts

/**
 * Interview Tools - 仅 confirmOutline
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { ToolContext } from "@/lib/ai/core/tool-context";

// ============================================
// Schemas
// ============================================

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number(),
  modules: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    chapters: z.array(z.string()),
  })).min(1),
});

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
      description: "生成并保存课程大纲，访谈结束时调用",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline) => {
        // 权限验证：确保课程属于当前用户
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        // 保存大纲
        const chapters = outline.modules.map((m, i) => ({
          title: m.title,
          description: m.description,
          topics: m.chapters,
          order: i,
        }));

        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: outline.estimatedMinutes,
            outlineData: { title: outline.title, chapters },
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

**Step 2: 重构 Interview Agent**

修改 `lib/ai/agents/interview.ts`：

```typescript
// lib/ai/agents/interview.ts

/**
 * INTERVIEW Agent - v6 状态机驱动
 */

import { stepCountIs, ToolLoopAgent, type ToolSet, type Output } from "ai";
import { aiProvider } from "../core";
import { createToolContext, type ToolContext } from "../core/tool-context";
import { buildAgentTools } from "../tools";
import { InterviewStateSchema, type InterviewState, computePhase } from "../schemas/interview";
import { INTERVIEW_PROMPT, getPhasePrompt } from "../prompts/interview";

const MAX_STEPS = 15;

// ============================================
// Types
// ============================================

export interface InterviewAgentOptions {
  userId: string;
  courseId: string;
  messages?: import("ai").UIMessage[];
  personalization?: {
    personaPrompt?: string;
    userContext?: string;
  };
}

// ============================================
// Agent Factory
// ============================================

export function createInterviewAgent(
  options: InterviewAgentOptions,
): ToolLoopAgent<InterviewState, ToolSet, Output> {
  if (!options.courseId) {
    throw new Error("Interview agent requires courseId");
  }

  const ctx: ToolContext = createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });

  const tools = buildAgentTools("interview", ctx) as ToolSet;

  return new ToolLoopAgent<InterviewState>({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    tools,

    // v6 标准：通过泛型定义 options 类型
    // prepareCall 的 options 参数类型由泛型 InterviewState 推断

    prepareCall: ({ options, ...rest }) => {
      const state = options ?? {};
      const phase = computePhase(state);

      const instructions = `${INTERVIEW_PROMPT}\n\n${getPhasePrompt(phase, state)}`;

      if (phase === "ready") {
        return {
          ...rest,
          instructions,
          toolChoice: { type: "tool", toolName: "confirmOutline" },
        };
      }

      return { ...rest, instructions };
    },

    stopWhen: stepCountIs(MAX_STEPS),
  });
}
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/ai/tools/interview/index.ts lib/ai/agents/interview.ts
git commit -m "refactor(ai): simplify interview to 1 tool + state machine"
```

---

## Task 9: 迁移 enhance.ts 到 generateText

**Files:**
- Modify: `lib/ai/tools/learning/enhance.ts`

**Step 1: 重构 mindMapTool 和 summarizeTool**

修改 `lib/ai/tools/learning/enhance.ts`：

```typescript
// lib/ai/tools/learning/enhance.ts

/**
 * Learning Tools - 思维导图和摘要
 */

import { tool } from "ai";
import { z } from "zod";
import { callNestedAI } from "@/lib/ai/core/nested-ai";

// ============================================
// Schemas
// ============================================

interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
}

const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    children: z.array(MindMapNodeSchema),
  }),
);

const MindMapDataSchema = z.object({
  nodes: MindMapNodeSchema,
});

const SummaryDataSchema = z.object({
  mainPoints: z.array(z.string()),
  summary: z.string(),
  keyTakeaways: z.array(z.string()),
});

// ============================================
// Tools
// ============================================

export const mindMapTool = tool({
  description: `将文本转化为结构化思维导图。

适用于：
- 解释复杂系统架构
- 用户需要全局视角时
- 整理知识结构`,

  inputSchema: z.object({
    topic: z.string().describe("中心主题"),
    content: z.string().optional().describe("要组织的内容"),
    maxDepth: z.number().min(1).max(4).default(3).describe("最大层级深度"),
  }),

  execute: async ({ topic, content, maxDepth }) => {
    const prompt = content
      ? `基于以下内容，为主题「${topic}」生成思维导图结构。

内容：
${content.slice(0, 2000)}

要求：
- 最大层级深度：${maxDepth}
- 每个父节点最多 5 个子节点
- 节点按逻辑分组`
      : `为主题「${topic}」生成思维导图结构。

要求：
- 最大层级深度：${maxDepth}
- 每个父节点最多 5 个子节点`;

    const result = await callNestedAI(prompt, MindMapDataSchema, {
      timeout: 45_000,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        mindMap: null,
      };
    }

    return {
      success: true,
      mindMap: {
        topic,
        maxDepth,
        nodes: result.data!.nodes,
      },
    };
  },
});

export const summarizeTool = tool({
  description: `降低认知负荷，生成内容摘要。

适用于：
- 用户面对长文档不知所措
- 需要快速回顾要点时`,

  inputSchema: z.object({
    content: z.string().describe("要摘要的内容"),
    length: z.enum(["brief", "medium", "detailed"]).default("medium"),
  }),

  execute: async ({ content, length }) => {
    const lengthGuide = {
      brief: "50-100 字",
      medium: "150-250 字",
      detailed: "300-500 字",
    };

    const prompt = `总结以下内容：

${content.slice(0, 4000)}

要求：
- 摘要长度：${lengthGuide[length]}
- 提取 3-5 个主要要点
- 提取 2-3 个关键收获`;

    const result = await callNestedAI(prompt, SummaryDataSchema, {
      timeout: 20_000,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        summary: null,
      };
    }

    return {
      success: true,
      summary: {
        sourceLength: content.length,
        length,
        ...result.data!,
      },
    };
  },
});
```

**Step 2: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/ai/tools/learning/enhance.ts
git commit -m "refactor(ai): migrate enhance tools to generateText + Output.object"
```

---

## Task 10: 更新 API Routes 使用新 streaming

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/interview/route.ts`

**Step 1: 更新 chat route**

在 `app/api/chat/route.ts` 中：

```typescript
// 修改导入
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";

// 修改响应创建部分
// 之前：
// const response = await createNexusNoteStreamResponse(agent, uiMessages);

// 之后：
const response = await createNexusNoteStreamResponse(agent, uiMessages, {
  sessionId,
});

// 移除手动设置的 headers（已在 createNexusNoteStreamResponse 内部处理）
```

**Step 2: 更新 interview route**

在 `app/api/interview/route.ts` 中：

```typescript
// 修改导入
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";

// 修改响应创建部分
const response = await createNexusNoteStreamResponse(agent, messages as UIMessage[], {
  sessionId,
  resourceId: state.courseId,
});

// 移除手动设置的 headers
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add app/api/chat/route.ts app/api/interview/route.ts
git commit -m "refactor(api): use new streaming with graceful degradation"
```

---

## Task 11: 删除旧文件并更新导出

**Files:**
- Delete: `lib/ai/streaming.ts`
- Modify: `lib/ai/index.ts`

**Step 1: 删除旧 streaming.ts**

```bash
rm lib/ai/streaming.ts
```

**Step 2: 更新 lib/ai/index.ts**

```typescript
// lib/ai/index.ts

// Core
export * from "./core";

// Schemas
export * from "./schemas";

// Prompts
export * from "./prompts";

// Tools
export * from "./tools";

// Agents
export * from "./agents";

// 其他现有导出保持不变
export * from "./core";
export * from "./validation";
export * from "./personalization";
```

**Step 3: 验证类型检查通过**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ai): remove old streaming.ts, update exports"
```

---

## Task 12: 最终验证

**Step 1: 运行完整类型检查**

Run: `bun run typecheck`
Expected: No errors

**Step 2: 运行 lint**

Run: `bun run lint`
Expected: No errors (or auto-fix)

**Step 3: 本地测试**

Run: `bun dev`

测试：
1. 打开 http://localhost:3000
2. 测试 Chat 功能
3. 测试 Interview 功能

**Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat(ai): complete AI SDK v6 refactor

- Add ToolContext factory pattern
- Add callNestedAI with timeout
- Add streaming with graceful degradation
- Add InterviewState state machine
- Add suggestOptions universal tool
- Migrate enhance tools to generateText
- Simplify interview tools to 1 tool

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 文件变更总结

### 新增文件 (9个)
- `lib/ai/core/tool-context.ts`
- `lib/ai/core/nested-ai.ts`
- `lib/ai/core/streaming.ts`
- `lib/ai/core/index.ts`
- `lib/ai/schemas/interview.ts`
- `lib/ai/schemas/index.ts`
- `lib/ai/prompts/chat.ts`
- `lib/ai/prompts/interview.ts`
- `lib/ai/prompts/index.ts`
- `lib/ai/tools/shared/suggest-options.ts`
- `lib/ai/tools/shared/index.ts`

### 修改文件 (6个)
- `lib/ai/tools/index.ts`
- `lib/ai/tools/interview/index.ts`
- `lib/ai/tools/learning/enhance.ts`
- `lib/ai/agents/interview.ts`
- `app/api/chat/route.ts`
- `app/api/interview/route.ts`

### 删除文件 (1个)
- `lib/ai/streaming.ts`

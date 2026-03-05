# AI SDK v6 彻底重构设计文档

> **状态**: 设计完成，待实施
> **日期**: 2026-03-05
> **范围**: 全量重构，彻底 v6 标准化

---

## 目标

将 NexusNote AI 系统从 2024-2025 架构彻底重构为 2026 AI SDK v6 最佳实践。

### 核心改进

| 维度 | 之前 | 之后 |
|------|------|------|
| Agent 控制 | 纯 prompt | `prepareCall` + `callOptionsSchema` + `toolChoice` |
| 工具权限 | 部分 userId 验证 | 统一 `ToolContext` 工厂模式 |
| 嵌套 AI | `generateObject` (废弃) | `generateText` + `Output.object` + timeout |
| 流式错误 | 无处理 | Graceful Degradation |
| 工具粒度 | 每个问题一个工具 | 通用 `suggestOptions` + 专用工具 |

---

## 架构概览

```
lib/ai/
├── core/
│   ├── index.ts           → 导出
│   ├── provider.ts        → AIProvider + CircuitBreaker
│   ├── agent-factory.ts   → createAgent() 统一工厂
│   ├── tool-context.ts    → ToolContext + 工具工厂模式
│   ├── nested-ai.ts       → callNestedAI() 封装
│   └── streaming.ts       → createStreamResponse() + 错误处理
│
├── agents/
│   ├── index.ts           → 导出
│   ├── chat.ts            → createChatAgent()
│   ├── course.ts          → createCourseAgent()
│   ├── interview.ts       → createInterviewAgent() + 状态机
│   └── skills.ts          → createSkillsAgent()
│
├── tools/
│   ├── index.ts           → buildAgentTools()
│   ├── shared/
│   │   └── suggest-options.ts  → 通用选项建议工具
│   ├── chat/              → search, notes, web-search
│   ├── editor/            → editDocument, batchEdit, draftContent
│   ├── interview/         → confirmOutline (仅此一个)
│   ├── learning/          → course, mindMap, summarize
│   ├── rag/               → hybridSearch
│   └── skills/            → discoverSkills
│
├── schemas/
│   ├── interview.ts       → InterviewStateSchema
│   ├── learning.ts
│   └── common.ts
│
└── prompts/
    ├── chat.ts
    ├── interview.ts
    └── learning.ts
```

---

## 第一节：ToolContext + 工具工厂模式

### ToolContext 定义

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

  /** 会话 ID - 可选，仅会话相关操作需要 */
  sessionId?: string;

  /** 资源 ID - 可选，仅特定资源操作需要 */
  resourceId?: string;

  /** 当前消息列表 - 可选 */
  messages?: UIMessage[];
}

export type ToolFactory<T = Record<string, unknown>> =
  (ctx: ToolContext) => T;
```

### 工具分类

```typescript
// lib/ai/tools/index.ts

export const toolRegistry = {
  // 全局工具 - 只需 userId，查询用户所有内容（液态知识库）
  global: {
    search: createSearchTools,
    rag: createRagTools,
    notes: createNoteTools,
    skills: createDiscoverSkillsTool,
  },

  // 资源工具 - 需要 userId + resourceId
  resource: {
    interview: createInterviewTools,
    course: createCourseTools,
  },

  // 通用工具 - 所有 Agent 共享
  shared: {
    suggestOptions: suggestOptionsTool,
    webSearch: webSearchTool,
  },
};

export function buildAgentTools(
  agentType: "chat" | "interview" | "course" | "skills",
  ctx: ToolContext,
): Record<string, unknown>;
```

---

## 第二节：Agent 工厂模式

### 统一创建入口

```typescript
// lib/ai/core/agent-factory.ts

import { ToolLoopAgent, type ToolSet, type Output } from "ai";

// Agent 类型定义
export type AgentType = "chat" | "interview" | "course" | "skills";

// 带泛型的返回类型
export function createAgent(type: "chat", options: ChatAgentOptions): ToolLoopAgent<never, ToolSet, Output>;
export function createAgent(type: "interview", options: InterviewAgentOptions): ToolLoopAgent<InterviewState, ToolSet, Output>;
export function createAgent(type: "course", options: CourseAgentOptions): ToolLoopAgent<never, ToolSet, Output>;
export function createAgent(type: "skills", options: AgentOptions): ToolLoopAgent<never, ToolSet, Output>;

// 统一实现
export function createAgent(type: AgentType, options: AgentOptions): ToolLoopAgent<unknown, ToolSet, Output> {
  const ctx = createToolContext({
    userId: options.userId,
    sessionId: options.sessionId,
    resourceId: options.resourceId,
    messages: options.messages,
  });

  switch (type) {
    case "chat":
      return createChatAgentImpl(ctx, options as ChatAgentOptions);
    case "interview":
      return createInterviewAgentImpl(ctx, options as InterviewAgentOptions);
    case "course":
      return createCourseAgentImpl(ctx, options as CourseAgentOptions);
    case "skills":
      return createSkillsAgentImpl(ctx, options);
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}
```

### Chat Agent 示例

```typescript
function createChatAgentImpl(
  ctx: ToolContext,
  options: ChatAgentOptions,
): ToolLoopAgent<never, ToolSet, Output> {
  const instructions = buildInstructions(CHAT_PROMPT, options.personalization);
  const tools = buildAgentTools("chat", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: aiProvider.chatModel,
    instructions,
    tools,
    stopWhen: stepCountIs(options.maxSteps ?? 20),
  });
}
```
```

---

## 第三节：Interview Agent 状态机

### 状态定义

```typescript
// lib/ai/schemas/interview.ts

export const InterviewStateSchema = z.object({
  goal: z.string().optional(),
  background: z.enum(["none", "beginner", "intermediate", "advanced"]).optional(),
  timeCommitment: z.enum(["casual", "moderate", "intensive"]).optional(),
  outcome: z.string().optional(),
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;

export function computePhase(state: InterviewState): InterviewPhase;
```

### Agent 实现

```typescript
// lib/ai/agents/interview.ts

export function createInterviewAgent(
  options: InterviewAgentOptions,
): ToolLoopAgent<InterviewState, ToolSet, Output> {
  return new ToolLoopAgent<InterviewState>({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    tools: buildAgentTools("interview", ctx),

    // v6 标准：通过泛型定义 options 类型，不是 schema
    // prepareCall 的 options 参数类型由泛型 InterviewState 推断

    prepareCall: ({ options, ...rest }) => {
      // options 类型是 InterviewState | undefined
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

    stopWhen: stepCountIs(15),
  });
}

// 调用方式：前端传递 options
await createAgentUIStreamResponse({
  agent: interviewAgent,
  uiMessages: messages,        // ← 消息历史
  options: interviewState,     // ← 前端传递的状态
});
```
```

### Interview 工具（仅 1 个）

```typescript
// lib/ai/tools/interview/index.ts

export const createInterviewTools = (ctx: ToolContext) => ({
  confirmOutline: tool({
    description: "生成并保存课程大纲",
    inputSchema: ConfirmOutlineSchema,
    execute: async (outline) => {
      // 权限验证
      const course = await db.query.courseSessions.findFirst({
        where: eq(courseSessions.id, courseId),
      });

      if (!course || course.userId !== ctx.userId) {
        return { success: false, error: "无权修改此课程" };
      }

      // 保存大纲...
    },
  }),
});
```

---

## 第四节：通用选项工具

### 工具定义

```typescript
// lib/ai/tools/shared/suggest-options.ts

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

### 使用方式

- 所有 Agent 都可以使用
- 前端点击选项 = 把选项文字作为用户输入发送
- 用户可以忽略选项直接对话

---

## 第五节：嵌套 AI 迁移

### 核心封装

```typescript
// lib/ai/core/nested-ai.ts

export async function callNestedAI<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: NestedAIOptions = {},
): Promise<NestedAIResult<T>> {
  const { timeout = 30_000, temperature = 0.3, useProModel = false } = options;
  const model = useProModel ? aiProvider.proModel : aiProvider.chatModel;

  try {
    const result = await generateText({
      model,
      prompt,
      temperature,
      timeout,  // ✅ 内置超时
      output: Output.object({ schema }),  // ✅ v6 标准
    });

    return { success: true, data: result.output as T, durationMs };
  } catch (error) {
    return { success: false, data: null, error: errorMessage, durationMs };
  }
}
```

### 专用 Helper

```typescript
export async function generateMindMap(topic: string, content?: string, maxDepth = 3);
export async function generateSummary(content: string, length?: "brief" | "medium" | "detailed");
```

### 迁移后工具

```typescript
// lib/ai/tools/learning/enhance.ts

export const mindMapTool = tool({
  execute: async ({ topic, content, maxDepth }) => {
    const result = await generateMindMap(topic, content, maxDepth);
    // ...
  },
});

export const summarizeTool = tool({
  execute: async ({ content, length }) => {
    const result = await generateSummary(content, length);
    // ...
  },
});
```

---

## 第六节：流式错误处理

### Graceful Degradation

```typescript
// lib/ai/core/streaming.ts

export async function createNexusNoteStreamResponse(
  agent: AnyAgent,
  messages: UIMessage[],
  options: StreamOptions = {},
): Promise<Response> {
  try {
    const response = await createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
    });

    // 添加响应头
    response.headers.set("X-Session-Id", sessionId);
    response.headers.set("X-Resource-Id", resourceId);

    return response;
  } catch (error) {
    console.error("[Streaming] Error:", error);

    // ✅ Graceful Degradation: 返回 fallback 文本流
    return createFallbackStream(
      getFallbackMessage(error),
      { sessionId, resourceId },
    );
  }
}
```

### Fallback 消息

```typescript
const FALLBACK_MESSAGES = {
  timeout: "抱歉，AI 响应超时，请稍后重试。",
  rate_limit: "请求过于频繁，请稍后再试。",
  model_error: "AI 模型暂时不可用，请稍后重试。",
  unknown: "抱歉，AI 服务出现异常，请稍后重试。",
};

/**
 * 创建 fallback 文本流
 *
 * AI SDK v6 stream 格式：
 * - 0:"文字"\n 表示文本内容
 * - d:{"finishReason":"stop"}\n 表示结束
 */
function createFallbackStream(
  message: string,
  headers: { sessionId?: string; resourceId?: string },
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 逐字符发送，模拟流式输出
      for (const char of message) {
        controller.enqueue(encoder.encode(`0:"${char}"\n`));
      }
      // 结束标记
      controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
      controller.close();
    },
  });

  const response = new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Stream-Error": "true",
    },
  });

  if (headers.sessionId) response.headers.set("X-Session-Id", headers.sessionId);
  if (headers.resourceId) response.headers.set("X-Resource-Id", headers.resourceId);

  return response;
}
```

### 前端集成

```typescript
// 前端需要在每次 sendMessage 时传递最新的 interviewState

// hooks/useInterview.ts
const handleSelectOption = (field: string, value: string) => {
  // 同步计算最新状态
  const newState = { ...interviewState, [field]: value };
  setInterviewState(newState);  // 更新本地状态

  // 发送消息时传递最新状态
  sendMessage({ text: value }, {
    body: { options: newState },  // ← 关键：同步传递
  });
};
```

---

## 迁移清单

### 新增文件

- [ ] `lib/ai/core/index.ts`
- [ ] `lib/ai/core/provider.ts` (从 core.ts 重构)
- [ ] `lib/ai/core/agent-factory.ts`
- [ ] `lib/ai/core/tool-context.ts`
- [ ] `lib/ai/core/nested-ai.ts`
- [ ] `lib/ai/core/streaming.ts` (从 lib/ai/streaming.ts 迁移)
- [ ] `lib/ai/tools/shared/suggest-options.ts`
- [ ] `lib/ai/schemas/interview.ts`
- [ ] `lib/ai/schemas/learning.ts`
- [ ] `lib/ai/schemas/common.ts`
- [ ] `lib/ai/prompts/chat.ts`
- [ ] `lib/ai/prompts/interview.ts`
- [ ] `lib/ai/prompts/learning.ts`

### 修改文件

- [ ] `lib/ai/agents/chat.ts` - 使用 createAgent 工厂
- [ ] `lib/ai/agents/course.ts` - 使用 createAgent 工厂
- [ ] `lib/ai/agents/interview.ts` - 添加状态机
- [ ] `lib/ai/agents/skills.ts` - 使用 createAgent 工厂
- [ ] `lib/ai/tools/interview/index.ts` - 简化为 1 个工具
- [ ] `lib/ai/tools/learning/enhance.ts` - 迁移到 generateText
- [ ] `lib/ai/tools/index.ts` - 添加 buildAgentTools
- [ ] `app/api/chat/route.ts` - 使用新 API
- [ ] `app/api/interview/route.ts` - 传递 interviewState

### 删除文件

- [ ] `lib/ai/streaming.ts` (迁移到 core/streaming.ts)
- [ ] `lib/ai/core.ts` (拆分到 core/ 目录)

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 大规模重构 | 高 | 分阶段迁移，保持向后兼容 |
| Interview 状态机 | 中 | 充分测试各阶段转换 |
| 流式错误处理 | 低 | Graceful 降级不影响主流程 |

---

## 参考

- [AI SDK v6 开发指南](../ai-sdk-v6-guide.md)
- [Vercel AI SDK 文档](https://sdk.vercel.ai/docs)

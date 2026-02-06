# NexusNote AI Interview 架构文档

> 供 AI 设计师评估和优化的完整技术文档

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              前端层                                      │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │  useCourseGeneration │───▶│   ChatInterface    │                     │
│  │       Hook          │    │     Component      │                     │
│  └─────────┬───────────┘    └─────────────────────┘                     │
│            │ sendMessage({ text, body: { context } })                   │
└────────────┼────────────────────────────────────────────────────────────┘
             │
             ▼ HTTP POST /api/ai
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Gateway                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /app/api/ai/route.ts                                           │    │
│  │  1. 认证检查 (auth)                                              │    │
│  │  2. 意图路由 (explicitIntent: "INTERVIEW")                       │    │
│  │  3. Agent 调度 (createAgentUIStreamResponse)                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└────────────┬────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Interview Agent                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ToolLoopAgent {                                                │    │
│  │    model: chatModel (已包含 extractReasoningMiddleware)          │    │
│  │    tools: { presentOptions, generateOutline }                   │    │
│  │    prepareCall: ({ options }) => {                              │    │
│  │      // 动态构建 instructions                                    │    │
│  │      // 根据 context 决定 stopWhen 策略                          │    │
│  │    }                                                            │    │
│  │  }                                                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心设计理念

### 2.1 代码掌舵，AI 划桨

| 层级 | 控制者 | 职责 |
|------|--------|------|
| **业务流程** | 代码 | 状态机、阶段判断、停止条件 |
| **对话内容** | AI | 自然语言生成、选项设计 |
| **UI 渲染** | 代码 | 工具输出的展示方式 |

### 2.2 隐式状态机

不使用显式的 `state: Phase1 | Phase2 | ...`，而是通过**数据缺口**驱动：

```typescript
// 通过检测 context 中的缺失字段决定当前阶段
const hasGoal = Boolean(context.goal);
const hasBackground = Boolean(context.background);
const hasTargetOutcome = Boolean(context.targetOutcome);
const hasCognitiveStyle = Boolean(context.cognitiveStyle);

if (!hasGoal) → Phase 1: 收集目标
if (!hasBackground) → Phase 2: 收集背景
if (!hasTargetOutcome) → Phase 3: 收集预期成果
if (!hasCognitiveStyle) → Phase 4: 收集学习风格
if (hasAllInfo) → Phase 5: 生成大纲
```

---

## 3. 数据流详解

### 3.1 完整请求周期

```
用户点击选项 "中国通史"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ ChatInterface.handleSendWithFeedback()                      │
│   text: "中国通史"                                           │
│   contextUpdate: { goal: "中国通史" }                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ useCourseGeneration.handleSendMessage()                     │
│   1. dispatch({ type: "UPDATE_CONTEXT", payload: contextUpdate })
│   2. sendMessage({                                          │
│        text: "中国通史",                                     │
│        body: {                                              │
│          context: {                                         │
│            explicitIntent: "INTERVIEW",                     │
│            interviewContext: { goal: "中国通史" },           │
│            isInInterview: true                              │
│          }                                                  │
│        }                                                    │
│      })                                                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ HTTP POST
┌─────────────────────────────────────────────────────────────┐
│ /api/ai/route.ts                                            │
│   interviewOptions = {                                      │
│     goal: "中国通史",                                        │
│     background: undefined,                                  │
│     targetOutcome: undefined,                               │
│     cognitiveStyle: undefined,                              │
│     userId: "user-123"                                      │
│   }                                                         │
│                                                             │
│   createAgentUIStreamResponse({                             │
│     agent: interviewAgent,                                  │
│     uiMessages: messages,                                   │
│     options: interviewOptions                               │
│   })                                                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Interview Agent prepareCall()                               │
│                                                             │
│   context = { goal: "中国通史", background: undefined, ... } │
│                                                             │
│   // 阶段检测                                                │
│   hasGoal = true                                            │
│   hasBackground = false  ← 当前阶段                         │
│                                                             │
│   // 动态 Prompt                                            │
│   instructions = "了解用户的相关背景（针对 中国通史）..."      │
│                                                             │
│   return {                                                  │
│     instructions,                                           │
│     temperature: 0.7,                                       │
│     stopWhen: hasToolCall("presentOptions")  ← 代码级约束    │
│   }                                                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ LLM 生成                                                    │
│                                                             │
│   Text: "好的，中国通史！那你的历史基础怎么样？"               │
│   Tool Call: presentOptions({                               │
│     question: "您的水平",                                    │
│     options: ["小白", "历史爱好者", "专业学生", "研究者"],     │
│     targetField: "background"                               │
│   })                                                        │
│                                                             │
│   ← hasToolCall("presentOptions") 触发，Agent 停止          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ Stream Response
┌─────────────────────────────────────────────────────────────┐
│ 前端接收 UIMessage                                          │
│                                                             │
│   message.parts = [                                         │
│     { type: "text", text: "好的，中国通史！..." },           │
│     { type: "tool-presentOptions",                          │
│       state: "output-available",                            │
│       input: { options: [...], targetField: "background" }  │
│     }                                                       │
│   ]                                                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ ChatInterface 渲染                                          │
│                                                             │
│   1. renderMessage() → 显示 AI 文本                         │
│   2. renderBeforeInput() → 检测 presentOptions 工具调用     │
│      → 显示选项按钮: [小白] [历史爱好者] [专业学生] [研究者]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 关键代码详解

### 4.1 Interview Agent (核心控制逻辑)

**文件**: `/apps/web/lib/ai/agents/interview/agent.ts`

```typescript
export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: chatModel!,  // 已包含 extractReasoningMiddleware
  tools: interviewTools,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewContextSchema,

  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as InterviewContext;

    // 动态构建 Prompt
    const instructions = buildInterviewPrompt(callOptions);

    // 阶段检测
    const hasGoal = Boolean(callOptions.goal);
    const hasBackground = Boolean(callOptions.background);
    const hasTargetOutcome = Boolean(callOptions.targetOutcome);
    const hasCognitiveStyle = Boolean(callOptions.cognitiveStyle);
    const hasAllInfo = hasGoal && hasBackground && hasTargetOutcome && hasCognitiveStyle;

    // Phase 5: 信息完整，强制生成大纲
    if (hasAllInfo) {
      return {
        ...rest,
        instructions,
        temperature: 0.8,
        toolChoice: { type: "tool", toolName: "generateOutline" },
        stopWhen: stepCountIs(1),
      };
    }

    // Phase 1-4: 收集信息，调用 presentOptions 后停止
    return {
      ...rest,
      instructions,
      temperature: 0.7,
      stopWhen: hasToolCall("presentOptions"),  // ← 关键：代码级停止条件
    };
  },
});
```

**设计要点**：
- `stopWhen: hasToolCall("presentOptions")` — AI SDK 内置函数，工具调用后立即停止
- `toolChoice: { type: "tool", toolName: "generateOutline" }` — 强制调用特定工具
- `stepCountIs(1)` — 只执行一步后停止

### 4.2 Interview Tools (工具定义)

**文件**: `/apps/web/lib/ai/tools/interview.ts`

```typescript
// 工具 1: 展示选项卡片
export const presentOptionsTool = tool({
  description: `向用户展示可点击的选项卡片。在询问用户具体问题后调用此工具。`,
  inputSchema: z.object({
    question: z.string().describe('卡片标题，5-10个字'),
    options: z.array(z.string()).min(2).max(4).describe('选项列表'),
    targetField: z.enum(['goal', 'background', 'targetOutcome', 'cognitiveStyle', 'general'])
      .describe('问题类型'),
    allowSkip: z.boolean().optional(),
    multiSelect: z.boolean().optional(),
  }),
  execute: async () => ({ status: 'ui_rendered' }),  // 纯 UI 工具，无副作用
});

// 工具 2: 生成课程大纲
export const generateOutlineTool = tool({
  description: `生成个性化课程大纲。仅在收集完所有必需信息后调用。`,
  inputSchema: z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    estimatedMinutes: z.number().min(30),
    modules: z.array(z.object({
      title: z.string(),
      chapters: z.array(z.object({
        title: z.string(),
        contentSnippet: z.string().optional(),
      })),
    })).min(2).max(20),
    reason: z.string(),
  }),
  execute: async (params) => ({
    status: 'outline_generated',
    ...params,
  }),
});
```

**设计要点**：
- `presentOptions` 是纯 UI 工具，execute 只返回状态标记
- `generateOutline` 返回结构化数据，前端监听并处理
- Zod Schema 提供物理层防御（限制选项数量等）

### 4.3 Interview Prompt (动态 Prompt)

**文件**: `/apps/web/lib/ai/prompts/interview.ts`

```typescript
export function buildInterviewPrompt(context: InterviewContext): string {
  const BASE_PERSONA = `课程导师。温暖专业。收集学习目标、背景、预期成果、学习风格，生成课程。对话为主，选项为辅。`;
  const TASK = injectTaskByPhase(context);
  return `${BASE_PERSONA}\n\n${TASK}`;
}

function injectTaskByPhase(context: InterviewContext): string {
  const hasGoal = Boolean(context.goal);
  const hasBackground = Boolean(context.background);
  const hasTargetOutcome = Boolean(context.targetOutcome);
  const hasCognitiveStyle = Boolean(context.cognitiveStyle);

  if (!hasGoal) {
    return `了解用户真实的学习目标，必须调用 presentOptions 提供选项。
例: "Python不错！你想往哪个方向？[然后调用 presentOptions]"`;
  }

  if (!hasBackground) {
    return `了解用户的相关背景（针对 ${context.goal}），必须调用 presentOptions 提供选项。`;
  }

  if (!hasTargetOutcome) {
    return `了解用户的预期成果（针对 ${context.goal}），必须调用 presentOptions 提供选项。`;
  }

  if (!hasCognitiveStyle) {
    return `了解用户的学习风格（针对 ${context.goal} 领域），必须调用 presentOptions 提供选项。`;
  }

  return `信息已齐: 目标=${context.goal}, 背景=${context.background}, 成果=${context.targetOutcome}, 风格=${context.cognitiveStyle}
直接调用 generateOutline 生成课程大纲。`;
}
```

**设计要点**：
- Prompt 简短，只提供当前阶段的指令
- 流程控制由 `prepareCall` 中的 `stopWhen` 保证，不依赖 Prompt

### 4.4 前端状态管理 (useCourseGeneration)

**文件**: `/apps/web/hooks/useCourseGeneration.ts`

```typescript
// Context 类型
interface InterviewContext {
  goal?: string;
  background?: string;
  targetOutcome?: string;
  cognitiveStyle?: string;
}

// 发送消息时同步更新 context
const handleSendMessage = useCallback(async (
  e?: React.FormEvent,
  overrideInput?: string,
  contextUpdate?: Partial<InterviewContext>,
) => {
  const text = overrideInput ?? input;

  // 计算最新 context
  const finalContext = contextUpdate
    ? { ...state.context, ...contextUpdate }
    : state.context;

  // 更新本地状态
  if (contextUpdate) {
    dispatch({ type: "UPDATE_CONTEXT", payload: contextUpdate });
  }

  // 发送到服务端
  sendMessage(
    { text },
    {
      body: {
        context: {
          explicitIntent: "INTERVIEW",
          interviewContext: finalContext,
          isInInterview: true,
        },
      },
    },
  );
}, [input, state.context, sendMessage]);
```

**设计要点**：
- `contextUpdate` 在点击选项时传入，如 `{ goal: "中国通史" }`
- 本地状态和发送的 context 同步更新
- 服务端 Agent 根据接收到的 context 决定下一阶段

### 4.5 工具调用的前端渲染 (ChatInterface)

**文件**: `/apps/web/components/create/ChatInterface.tsx`

```typescript
// 从最后一条 assistant 消息中提取 presentOptions 工具调用
if (lastMessage?.role === "assistant" && lastMessage.parts) {
  const presentOptionsPart = lastMessage.parts.find(
    part => isToolUIPart(part) && getToolName(part) === 'presentOptions'
  );

  if (presentOptionsPart && isToolUIPart(presentOptionsPart)) {
    if (presentOptionsPart.state === 'output-available') {
      const input = presentOptionsPart.input as {
        options: string[];
        targetField: string;
      };
      activeToolOptions = {
        options: input.options,
        targetField: input.targetField,
      };
    }
  }
}

// 渲染选项按钮
renderBeforeInput={() => (
  <>
    {activeToolOptions?.options && !isAiThinking && (
      <motion.div className="px-4 pb-3 flex flex-wrap gap-3 justify-end">
        {activeToolOptions.options.map((option) => {
          const targetField = activeToolOptions!.targetField;
          const contextUpdate = targetField !== 'general'
            ? { [targetField]: option }
            : undefined;

          return (
            <button
              key={option}
              onClick={() => handleSendWithFeedback(undefined, option, contextUpdate)}
            >
              {option}
            </button>
          );
        })}
      </motion.div>
    )}
  </>
)}
```

**设计要点**：
- 通过 `isToolUIPart` 和 `getToolName` 识别工具调用
- `targetField` 决定点击后更新哪个 context 字段
- 按钮固定在输入框上方（`renderBeforeInput`），不随消息滚动

---

## 5. 状态流转图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Interview Flow                               │
└─────────────────────────────────────────────────────────────────────┘

用户输入 "历史"
     │
     ▼
┌─────────────┐     AI 回复 + presentOptions     ┌─────────────┐
│  Phase 1    │ ───────────────────────────────▶ │   等待选择   │
│  收集目标   │     options: [历史方向...]        │   goal      │
└─────────────┘                                  └──────┬──────┘
                                                       │
用户点击 "中国通史"                                      │
context.goal = "中国通史" ◀────────────────────────────┘
     │
     ▼
┌─────────────┐     AI 回复 + presentOptions     ┌─────────────┐
│  Phase 2    │ ───────────────────────────────▶ │   等待选择   │
│  收集背景   │     options: [小白, 爱好者...]    │  background │
└─────────────┘                                  └──────┬──────┘
                                                       │
用户点击 "历史爱好者"                                    │
context.background = "历史爱好者" ◀────────────────────┘
     │
     ▼
┌─────────────┐     AI 回复 + presentOptions     ┌─────────────┐
│  Phase 3    │ ───────────────────────────────▶ │   等待选择   │
│ 收集预期成果 │     options: [考试, 兴趣...]     │targetOutcome│
└─────────────┘                                  └──────┬──────┘
                                                       │
用户点击 "纯粹兴趣"                                      │
context.targetOutcome = "纯粹兴趣" ◀───────────────────┘
     │
     ▼
┌─────────────┐     AI 回复 + presentOptions     ┌─────────────┐
│  Phase 4    │ ───────────────────────────────▶ │   等待选择   │
│ 收集学习风格 │     options: [故事, 时间线...]   │cognitiveStyle│
└─────────────┘                                  └──────┬──────┘
                                                       │
用户点击 "故事驱动"                                      │
context.cognitiveStyle = "故事驱动" ◀──────────────────┘
     │
     ▼
┌─────────────┐     toolChoice: generateOutline  ┌─────────────┐
│  Phase 5    │ ───────────────────────────────▶ │  生成大纲    │
│  信息完整   │     强制调用 + stepCountIs(1)     │   完成!     │
└─────────────┘                                  └─────────────┘
```

---

## 6. AI SDK 关键 API 使用

### 6.1 ToolLoopAgent

```typescript
new ToolLoopAgent({
  id: string,                    // Agent 标识
  model: LanguageModel,          // LLM 模型
  tools: ToolSet,                // 可用工具集
  callOptionsSchema: ZodSchema,  // 调用参数 Schema
  prepareCall: (params) => PrepareCallResult,  // 核心：动态配置
})
```

### 6.2 stopWhen 条件

| 函数 | 用途 |
|------|------|
| `stepCountIs(n)` | 执行 n 步后停止 |
| `hasToolCall(toolName)` | 调用特定工具后停止 |

### 6.3 toolChoice 选项

| 值 | 行为 |
|----|------|
| `undefined` | AI 自由决定是否调用工具 |
| `{ type: "auto" }` | 同上 |
| `{ type: "none" }` | 禁止调用工具 |
| `{ type: "tool", toolName: "xxx" }` | 强制调用特定工具 |

### 6.4 createAgentUIStreamResponse

```typescript
createAgentUIStreamResponse({
  agent: Agent,
  uiMessages: UIMessage[],
  options: AgentOptions,
  experimental_transform: Transform,  // 如 smoothStream
  onError: (error) => string,
})
```

---

## 7. 已知问题和优化建议

### 7.1 当前问题

| 问题 | 原因 | 当前解决方案 |
|------|------|-------------|
| AI 可能幻觉用户选择 | LLM 行为不可控 | `hasToolCall()` 代码级约束 |
| Prompt 过于简单 | 依赖 stopWhen | 可接受，控制在代码层 |
| 选项只能单选 | UI 限制 | 未实现 multiSelect |

### 7.2 可优化方向

1. **Prompt Engineering**
   - 当前 Prompt 非常简短，可能导致 AI 回复质量不稳定
   - 可增加更多示例和边界情况处理

2. **错误恢复**
   - 如果 AI 没有调用 presentOptions 怎么办？
   - 可增加 fallback 逻辑

3. **多模态支持**
   - 当前只支持文本，未来可支持图片/文件上传

4. **流程可配置**
   - 当前 4 个维度是硬编码的
   - 可抽象为配置，支持不同的访谈流程

---

## 8. 文件清单

| 文件 | 职责 |
|------|------|
| `/lib/ai/agents/interview/agent.ts` | Interview Agent 定义 |
| `/lib/ai/tools/interview.ts` | presentOptions + generateOutline 工具 |
| `/lib/ai/prompts/interview.ts` | 动态 Prompt 构建 |
| `/lib/ai/registry.ts` | AI 模型注册和配置 |
| `/app/api/ai/route.ts` | API Gateway，Agent 调度 |
| `/hooks/useCourseGeneration.ts` | 前端状态管理 |
| `/components/create/ChatInterface.tsx` | 聊天 UI 渲染 |
| `/components/ai/UnifiedChatUI.tsx` | 通用聊天组件 |

---

## 9. 附录：完整代码

> 见上方 Agent 收集的 7 个文件完整内容

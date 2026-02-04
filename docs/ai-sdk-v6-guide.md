# AI SDK v6 开发指南（NexusNote 实战版）

> 基于 AI SDK 6.0.67 和实际项目验证
> 最后更新：2026-02-04

## 目录

1. [核心架构](#核心架构)
2. [消息格式（UIMessage）](#消息格式uimessage)
3. [工具调用（Tool Calling）](#工具调用tool-calling)
4. [Agent 开发（ToolLoopAgent）](#agent-开发toolloopagent)
5. [前端集成（useChat）](#前端集成usechat)
6. [状态管理原则](#状态管理原则)
7. [常见错误](#常见错误)

---

## 核心架构

### 2026 年标准架构

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │         │   Backend   │         │   AI Model  │
│  (useChat)  │◄────────┤   (Agent)   │◄────────┤   (GPT-4)   │
└─────────────┘         └─────────────┘         └─────────────┘
      │                        │                        │
      │  sendMessage()         │  prepareCall()         │
      │  + context             │  + instructions        │
      │                        │  + toolChoice          │
      │                        │                        │
      │◄─ Stream ─────────────┤◄─ Tools + Text ────────┤
      │  UIMessageChunk        │  Server-side exec      │
      │                        │                        │
      │  Read message.parts    │                        │
      │  Extract tool data     │                        │
      │  Update local state    │                        │
      └────────────────────────┴────────────────────────┘
```

**职责分离：**
- **Frontend**: 管理状态（State），读取工具数据，更新 UI
- **Backend**: 构建指令（Instructions），决定调用哪个工具（Tool Choice）
- **AI**: 生成内容（Content），执行工具调用（Server-side）

---

## 消息格式（UIMessage）

### 类型定义（源码）

```typescript
// node_modules/ai/dist/index.d.ts:1292
interface UIMessage<METADATA = unknown, DATA_PARTS extends UIDataTypes = UIDataTypes, TOOLS extends UITools = UITools> {
  id: string;
  role: 'user' | 'assistant' | 'system';
  createdAt?: Date;
  metadata?: METADATA;
  parts: Array<UIMessagePart<DATA_PARTS, TOOLS>>;
}

// UIMessagePart 可以是以下类型之一：
type UIMessagePart<DATA_TYPES, TOOLS> =
  | TextUIPart          // 文本内容
  | ReasoningUIPart     // 推理过程
  | ToolUIPart<TOOLS>   // 工具调用 ← 重点
  | DynamicToolUIPart   // 动态工具
  | FileUIPart          // 文件
  | DataUIPart          // 自定义数据
  | StepStartUIPart     // 步骤边界
```

### ToolUIPart 格式（最重要）

```typescript
// node_modules/ai/dist/index.d.ts:1505-1509
type ToolUIPart<TOOLS extends UITools = UITools> = ValueOf<{
  [NAME in keyof TOOLS & string]: {
    type: `tool-${NAME}`;  // ← 注意：类型名称格式是 "tool-工具名"
  } & UIToolInvocation<TOOLS[NAME]>;
}>;

// UIToolInvocation 包含工具调用的详细信息
type UIToolInvocation<TOOL> = {
  toolCallId: string;    // 工具调用 ID
  title?: string;        // 可选标题
  providerExecuted?: boolean;
} & (
  | { state: 'input-streaming'; input: DeepPartial<TOOL['input']> }
  | { state: 'input-available'; input: TOOL['input'] }
  | { state: 'output-available'; input: TOOL['input']; output: TOOL['output'] }
  | { state: 'output-error'; input: TOOL['input']; errorText: string }
);
```

### 实战示例

假设我们有工具 `presentOptions` 和 `generateOutline`：

```typescript
// 工具定义
const tools = {
  presentOptions: tool({
    description: '展示选项卡片',
    inputSchema: z.object({
      question: z.string(),
      options: z.array(z.string()),
      targetField: z.enum(['goal', 'background', 'time', 'general']),
    }),
    execute: async () => ({ status: 'ui_rendered' }),
  }),
  generateOutline: tool({
    description: '生成课程大纲',
    inputSchema: z.object({
      title: z.string(),
      modules: z.array(z.object({
        title: z.string(),
        chapters: z.array(z.object({ title: z.string() })),
      })),
    }),
    execute: async (params) => ({ status: 'outline_generated', ...params }),
  }),
};

// AI 返回的消息格式
const message: UIMessage = {
  id: 'msg-123',
  role: 'assistant',
  createdAt: new Date(),
  parts: [
    // Part 1: 文本内容
    {
      type: 'text',
      text: '好的！我明白了您的目标。请问您的编程基础如何？',
      state: 'done',
    },
    // Part 2: 工具调用（presentOptions）
    {
      type: 'tool-presentOptions',  // ← 格式：tool-{工具名}
      toolCallId: 'call-abc-123',
      state: 'output-available',
      input: {
        question: '您的水平',
        options: ['零基础', '有基础', '有经验', '专业级'],
        targetField: 'background',
      },
      output: { status: 'ui_rendered' },
    },
  ],
};
```

---

## 工具调用（Tool Calling）

### 工具定义

```typescript
import { tool } from 'ai';
import { z } from 'zod';

// ✅ 正确：使用 Zod Schema 进行类型安全
export const presentOptionsTool = tool({
  description: `向用户展示可点击的选项卡片。在询问用户具体问题后调用此工具。`,

  inputSchema: z.object({
    question: z.string()
      .describe('卡片标题，5-10个字'),

    options: z.array(z.string())
      .min(2)
      .max(4)
      .describe('选项列表，必须提供2-4个字符串'),

    targetField: z.enum(['goal', 'background', 'time', 'general'])
      .describe('问题类型'),
  }),

  execute: async (params) => {
    console.log('[presentOptions]', params);
    return { status: 'ui_rendered' };
  },
});

// 导出工具集合
export const interviewTools = {
  presentOptions: presentOptionsTool,
  generateOutline: generateOutlineTool,
};

export type InterviewToolName = keyof typeof interviewTools;
```

### 前端读取工具数据

```typescript
import { UIMessage } from 'ai';

function extractToolCalls(message: UIMessage) {
  if (!message.parts) return [];

  // ✅ 正确：从 message.parts 读取工具调用
  const toolParts = message.parts.filter(
    (p: any) => p.type?.startsWith('tool-')
  );

  return toolParts.map((part: any) => ({
    toolName: part.type.replace('tool-', ''),  // 'tool-presentOptions' → 'presentOptions'
    toolCallId: part.toolCallId,
    input: part.input,      // ← 注意：是 input，不是 args
    output: part.output,
    state: part.state,
  }));
}

// 使用示例
const lastMessage = messages[messages.length - 1];
const tools = extractToolCalls(lastMessage);

// 检测特定工具
const presentOptionsTool = tools.find(t => t.toolName === 'presentOptions');
if (presentOptionsTool?.input) {
  const { question, options, targetField } = presentOptionsTool.input;
  // 渲染 UI 组件
}
```

---

## Agent 开发（ToolLoopAgent）

### Agent 定义

```typescript
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';
import { z } from 'zod';
import { chatModel } from '@/lib/ai/registry';
import { interviewTools } from '@/lib/ai/tools/interview';

// 1. 定义调用选项 Schema
const InterviewCallOptionsSchema = z.object({
  goal: z.string().optional(),
  background: z.string().optional(),
  time: z.string().optional(),
});

export type InterviewCallOptions = z.infer<typeof InterviewCallOptionsSchema>;

// 2. 创建 Agent
export const interviewAgent = new ToolLoopAgent({
  id: 'nexusnote-interview',
  model: chatModel!,
  tools: interviewTools,
  maxOutputTokens: 4096,
  callOptionsSchema: InterviewCallOptionsSchema,

  // 3. prepareCall：核心逻辑
  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as InterviewCallOptions;

    // 检测数据缺口
    const hasGoal = Boolean(callOptions.goal);
    const hasBackground = Boolean(callOptions.background);
    const hasTime = Boolean(callOptions.time);
    const hasAllInfo = hasGoal && hasBackground && hasTime;

    // 动态构建 System Prompt
    const instructions = buildInterviewPrompt(callOptions);

    // Phase 4: 强制调用 generateOutline
    if (hasAllInfo) {
      return {
        ...rest,
        instructions,
        temperature: 0.8,
        toolChoice: { type: 'tool', toolName: 'generateOutline' },  // ← 强制工具
      };
    }

    // Phase 1-3: AI 自由调用工具
    return {
      ...rest,
      instructions,
      temperature: 0.7,
    };
  },
});

// 4. 导出消息类型（供 useChat 使用）
export type InterviewAgentMessage = InferAgentUIMessage<typeof interviewAgent>;
```

### 动态 Prompt 构建

```typescript
function buildInterviewPrompt(context: InterviewCallOptions): string {
  const hasGoal = Boolean(context.goal);
  const hasBackground = Boolean(context.background);
  const hasTime = Boolean(context.time);

  // 进度展示
  const progress = `
## 📊 当前收集进度

${hasGoal ? '✅' : '⏳'} **学习目标**${hasGoal ? `: ${context.goal}` : '（待确认）'}
${hasBackground ? '✅' : '⏳'} **学习背景**${hasBackground ? `: ${context.background}` : '（待确认）'}
${hasTime ? '✅' : '⏳'} **可用时间**${hasTime ? `: ${context.time}` : '（待确认）'}
  `.trim();

  // Phase 1: 收集目标
  if (!hasGoal) {
    return `
${progress}

当前任务：了解用户的学习目标。

与用户简短对话后，调用 presentOptions 工具展示选项。
    `.trim();
  }

  // Phase 2: 收集背景
  if (!hasBackground) {
    return `
${progress}

当前任务：了解用户的学习背景（针对 ${context.goal}）。

与用户对话，然后调用 presentOptions。
    `.trim();
  }

  // Phase 3: 收集时间
  if (!hasTime) {
    return `
${progress}

当前任务：了解用户的时间投入。

与用户对话，然后调用 presentOptions。
    `.trim();
  }

  // Phase 4: 生成大纲
  return `
${progress}

当前任务：确认信息并生成课程大纲。

基于收集的信息（${context.goal}・${context.background}・${context.time}），调用 generateOutline 工具生成完整方案。
  `.trim();
}
```

### 后端路由

```typescript
// app/api/ai/route.ts
import { interviewAgent } from '@/lib/ai/agents/interview/agent';

export async function POST(req: Request) {
  const { messages, context } = await req.json();

  const { explicitIntent, interviewContext, isInInterview } = context || {};

  if (explicitIntent === 'INTERVIEW' && isInInterview) {
    // 使用 Interview Agent
    return interviewAgent.toUIMessageStreamResponse({
      request: req,
      messages: messages,
      options: interviewContext,  // ← 传递 context 给 prepareCall
    });
  }

  // 其他逻辑...
}
```

---

## 前端集成（useChat）

### useChat Hook

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo, useEffect } from 'react';
import type { InterviewAgentMessage } from '@/lib/ai/agents/interview/agent';

export function useCourseGeneration() {
  const [context, setContext] = useState({
    goal: undefined,
    background: undefined,
    time: undefined,
  });

  // 1. 创建 Transport
  const chatTransport = useMemo(
    () => new DefaultChatTransport({ api: '/api/ai' }),
    []
  );

  // 2. 使用 useChat（泛型指定消息类型）
  const { messages, sendMessage, status } = useChat<InterviewAgentMessage>({
    transport: chatTransport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // 3. 发送消息（携带 context）
  const handleSendMessage = useCallback(
    async (text: string, contextUpdate?: Partial<InterviewContext>) => {
      // 同步计算最新 context（关键！）
      const finalContext = contextUpdate
        ? { ...context, ...contextUpdate }
        : context;

      // 同步更新本地状态
      if (contextUpdate) {
        setContext(finalContext);
      }

      // 发送消息（使用计算出的最新值）
      sendMessage(
        { text },
        {
          body: {
            context: {
              explicitIntent: 'INTERVIEW',
              interviewContext: finalContext,  // ← 保证使用最新值
              isInInterview: true,
            },
          },
        }
      );
    },
    [context, sendMessage]
  );

  // 4. 监听工具调用（从 message.parts 读取）
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1] as any;
    if (!lastMessage.parts) return;

    // ✅ 正确：检测 tool-generateOutline
    const generateOutlinePart = lastMessage.parts.find(
      (p: any) => p.type === 'tool-generateOutline'
    );

    if (!generateOutlinePart) return;
    if (processedToolCallIds.current.has(generateOutlinePart.toolCallId)) return;

    // 读取 input（不是 args）
    const outline = generateOutlinePart.input;

    if (!outline.title || !outline.modules) return;

    // 处理大纲数据
    setOutline(outline);
    transitionToPhase('outline_review');

    // 标记已处理
    processedToolCallIds.current.add(generateOutlinePart.toolCallId);
  }, [messages]);

  return {
    messages,
    isLoading,
    handleSendMessage,
  };
}
```

### UI 组件

```typescript
function ChatInterface({ messages, onSendMessage, context }) {
  const lastMessage = messages[messages.length - 1];

  // 提取工具选项
  const toolPart = lastMessage?.parts?.find(
    (p: any) => p.type === 'tool-presentOptions'
  );

  const options = toolPart?.input?.options || [];
  const targetField = toolPart?.input?.targetField;

  return (
    <div>
      {/* 显示历史消息 */}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* 显示选项按钮 */}
      {options.length > 0 && (
        <div>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                // 前端同步更新 context
                const contextUpdate = targetField && targetField !== 'general'
                  ? { [targetField]: option }
                  : undefined;

                // 发送消息
                onSendMessage(option, contextUpdate);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 状态管理原则

### 2026 年标准：前端为单一数据源

```
❌ 错误架构（会导致状态不同步）：

User clicks option
  ↓
Frontend sends message (with OLD context)
  ↓
AI receives empty context → calls updateProfile tool
  ↓
Frontend receives tool call → updates state
  ↓
User clicks next option
  ↓
Frontend sends message (STILL with OLD context, React state update is async)
```

```
✅ 正确架构（同步状态更新）：

User clicks option
  ↓
Frontend IMMEDIATELY calculates new context (sync)
  ↓
Frontend sends message WITH new context (sync)
  ↓
AI receives correct context → makes phase decision
  ↓
When all data collected → Force call generateOutline
  ↓
Frontend detects tool in message.parts → transitions UI
```

### 关键代码模式

```typescript
// ❌ 错误：依赖异步的 state 更新
const handleSend = () => {
  setContext({ ...context, field: value });  // 异步
  sendMessage(text, { context });  // ← 这里的 context 还是旧值
};

// ✅ 正确：同步计算最新值
const handleSend = (value: string, contextUpdate: any) => {
  const finalContext = contextUpdate
    ? { ...context, ...contextUpdate }  // 同步计算
    : context;

  setContext(finalContext);  // 异步更新（不依赖它）

  sendMessage(text, {
    body: { context: finalContext }  // ← 使用计算出的值
  });
};
```

### 工具职责分离

| 工具类型 | 职责 | 示例 |
|---------|------|------|
| ❌ `updateProfile` | AI 更新状态 | 不应存在！状态由前端管理 |
| ✅ `presentOptions` | AI 生成选项供用户选择 | 返回选项数组和问题 |
| ✅ `generateOutline` | AI 生成内容 | 返回课程大纲 JSON |

---

## 常见错误

### 错误 1：检查错误的字段

```typescript
// ❌ 错误：AI SDK v6 Agent UI 不使用 toolInvocations
if (message.toolInvocations) {
  // 这个字段不存在或为空
}

// ✅ 正确：从 message.parts 读取
const toolParts = message.parts?.filter(
  (p: any) => p.type?.startsWith('tool-')
);
```

### 错误 2：读取 args 而不是 input

```typescript
// ❌ 错误：
const params = toolPart.args;  // undefined

// ✅ 正确：
const params = toolPart.input;  // { question: '...', options: [...] }
```

### 错误 3：使用字符串类型而不是模板字面量

```typescript
// ❌ 错误：
if (part.type === 'presentOptions') {  // 永远不会匹配

// ✅ 正确：
if (part.type === 'tool-presentOptions') {  // 格式：tool-{工具名}
```

### 错误 4：AI 管理状态

```typescript
// ❌ 错误架构：
const updateProfileTool = tool({
  description: '更新用户资料',
  inputSchema: z.object({
    field: z.enum(['goal', 'background', 'time']),
    value: z.string(),
  }),
  execute: async ({ field, value }) => {
    // AI 试图更新前端状态
    return { updated: true };
  },
});

// ✅ 正确架构：
// 删除此工具，状态管理由前端负责
// AI 只负责生成内容（presentOptions, generateOutline）
```

### 错误 5：依赖异步状态更新

```typescript
// ❌ 错误：
onClick={() => {
  dispatch({ type: 'UPDATE_CONTEXT', payload: { goal: 'Web开发' } });
  // state.context 此时还是旧值
  sendMessage('开始', { context: state.context });
}}

// ✅ 正确：
onClick={() => {
  const newContext = { ...state.context, goal: 'Web开发' };
  dispatch({ type: 'UPDATE_CONTEXT', payload: { goal: 'Web开发' } });
  sendMessage('开始', { context: newContext });  // 使用计算值
}}
```

### 错误 6：兼容层和防御性编程

```typescript
// ❌ 错误：添加多余的兼容逻辑
const input = part.input || part.args || part.arguments;
const toolName = part.toolName || part.type.replace('tool-', '');

// ✅ 正确：直接使用确定的格式
const input = part.input;  // AI SDK v6 Agent UI 格式
const toolName = part.type.replace('tool-', '');
```

---

## 调试技巧

### 1. 控制台日志

```typescript
// 前端
useEffect(() => {
  console.log('[Tool Sync] Last message:', lastMessage);
  console.log('[Tool Sync] Parts:', lastMessage?.parts);

  const toolParts = lastMessage?.parts?.filter(
    (p: any) => p.type?.startsWith('tool-')
  );
  console.log('[Tool Sync] Tool parts:', toolParts);
}, [messages]);

// 后端
prepareCall: ({ options, ...rest }) => {
  console.log('[Agent] prepareCall options:', options);

  const hasAllInfo = hasGoal && hasBackground && hasTime;
  console.log('[Agent] Phase detection:', { hasGoal, hasBackground, hasTime, hasAllInfo });

  if (hasAllInfo) {
    console.log('[Agent] ✅ All info collected, FORCING generateOutline');
  }
}
```

### 2. 类型检查

```typescript
// 使用类型守卫
import { isToolUIPart } from 'ai';

message.parts.forEach((part) => {
  if (isToolUIPart(part)) {
    console.log('Tool part:', part.type, part.input);
  }
});
```

### 3. 断点调试

在关键位置设置断点：
- `handleSendMessage` - 检查 context 值
- `useEffect` (监听 messages) - 检查 message.parts
- `prepareCall` - 检查 options 和 phase 判断

---

## 最佳实践总结

1. **前端为单一数据源** - 所有状态由前端管理，AI 只生成内容
2. **同步状态更新** - 在发送消息前同步计算最新 context
3. **从 message.parts 读取工具** - 格式为 `{type: 'tool-{toolName}', input: {...}}`
4. **使用 toolChoice 强制工具调用** - 当条件满足时，强制 AI 调用特定工具
5. **动态 Prompt 构建** - 根据数据缺口注入不同的指令
6. **避免兼容层** - 使用确定的格式，不要添加多余的防御性代码
7. **TypeScript 类型安全** - 使用 `InferAgentUIMessage` 获得完整类型提示

---

## 参考资料

- AI SDK v6 官方文档: https://sdk.vercel.ai/docs
- 源码类型定义: `node_modules/ai/dist/index.d.ts`
- NexusNote 实战代码:
  - `/apps/web/lib/ai/agents/interview/agent.ts`
  - `/apps/web/hooks/useCourseGeneration.ts`
  - `/apps/web/components/create/ChatInterface.tsx`

---

**版本历史：**
- v1.0 (2026-02-04) - 初始版本，基于 NexusNote Interview Agent 实战

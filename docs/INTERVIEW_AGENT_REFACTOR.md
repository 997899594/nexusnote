# Interview Agent 重构方案

> 日期：2026-02-13
> 状态：待实施
> 优先级：高 — 影响核心用户流程

## 问题概述

`/create?goal=xxx` 页面的 interview 流程存在根本性设计错误：AI 一口气问完四个问题并生成大纲，用户全程无法参与对话。

**根因：把 human-in-the-loop 场景误写成了 autonomous agent 模式。**

---

## 一、当前架构的具体问题

### 问题 1：`presentOptions` 不应该有 `execute` 函数

**文件**：`features/learning/tools/interview.ts:22-44`

```typescript
// ❌ 当前写法 — agent 认为工具已自主完成，继续循环
export const presentOptionsTool = tool({
  inputSchema: z.object({ ... }),
  execute: async () => ({ status: "ui_rendered" }),
});
```

AI SDK v6 的规则：
- **有 `execute`** → 服务端自动执行，agent 循环继续
- **没有 `execute`** → agent 循环自动停止，等待客户端通过 `addToolOutput` 返回结果

`presentOptions` 是交互型工具（需要用户点选项），不应该有 `execute`。给了 `execute` 等于告诉 ToolLoopAgent"不需要人参与"。

### 问题 2：`prepareCall` vs `prepareStep` 用混了

**文件**：`features/learning/agents/interview/agent.ts:67-146`

| 钩子 | 调用时机 | 适合的逻辑 |
|------|---------|-----------|
| `prepareCall` | 每次请求调用**一次** | 请求级配置：注入用户信息、RAG、选模型 |
| `prepareStep` | 循环内**每步**都调用 | 步级控制：根据步数切换 toolChoice、动态工具 |

当前所有 phase 检测、`toolChoice` 强制、`stopWhen` 全在 `prepareCall` 里——只执行一次，无法在循环内动态调整。

### 问题 3：状态管理三源头

当前状态流经三个地方：

```
客户端 useReducer (context)
    ↓ 手动复制到
sendMessage body (interviewContext)
    ↓ 手动复制到
服务端 prepareCall options
```

每次用户选择后要手动 dispatch + 构造 body + 服务端解析——三份拷贝容易不同步。

AI SDK v6 的理念：**`UIMessage[]` 是唯一状态源**。工具输入输出自然记录在消息历史中，服务端从历史重建状态。

### 问题 4：`stopWhen: stepCountIs(1)` 是临时补丁

**文件**：`features/learning/agents/interview/agent.ts:126-145`

2026-02-13 加的 `stopWhen: stepCountIs(1)` 能解决症状（AI 不会一口气跑完），但本质是绕过问题——正确的做法是让工具本身就能停止循环。

---

## 二、正确的 2026 架构

### 核心原则

| 概念 | 说明 |
|------|------|
| **Client-side Tool** | 没有 `execute` 的工具 → agent 循环自动暂停 |
| **`addToolOutput`** | 客户端提供工具结果 → 自动触发下一轮请求 |
| **`sendAutomaticallyWhen`** | 当所有工具都有输出时自动发送 |
| **消息历史即状态** | 不需要 side-channel 传递 context |

### 改造后的数据流

```
用户输入 "你是谁"
  → sendMessage({ text: "你是谁" })
  → 服务端 agent.stream()
  → AI 输出文字 + 调用 presentOptions（无 execute → 循环自动停止）
  → 客户端 useChat 收到 tool part，state = "input-available"
  → UI 渲染选项按钮
  → 用户点击 "Web开发"
  → addToolOutput({ tool: "presentOptions", toolCallId, output: '{"selected":"Web开发"}' })
  → sendAutomaticallyWhen 触发 → 自动发起下一轮请求
  → 服务端从消息历史提取已收集信息 → AI 问下一个问题
  → ...重复直到四个维度收集完毕
  → AI 调用 generateOutline（有 execute → 服务端执行，返回大纲）
  → 客户端收到大纲 → 进入 outline_review phase
```

---

## 三、改造步骤

### Step 1：改造 `presentOptions` 为 client-side tool

**文件**：`features/learning/tools/interview.ts`

```typescript
// ✅ 正确写法 — 没有 execute，agent 循环自动暂停等待用户
export const presentOptionsTool = tool({
  description: "向用户展示可点击的选项卡片，等待用户选择",
  inputSchema: z.object({
    replyToUser: z.string().describe("对用户说的话"),
    question: z.string().describe("卡片标题，5-10个字"),
    options: z.array(z.string()).min(2).max(4).describe("选项列表"),
    targetField: z
      .enum(["goal", "background", "targetOutcome", "cognitiveStyle", "general"])
      .describe("问题类型"),
    allowSkip: z.boolean().optional(),
    multiSelect: z.boolean().optional(),
  }),
  // 没有 execute → 自动变成 client-side tool
});
```

`generateOutline` 保留 `execute`（不需要用户交互，服务端自主完成）。

### Step 2：客户端用 `addToolOutput` 替代 `handleSendMessage`

**文件**：`features/learning/hooks/useCourseGeneration.ts`

```typescript
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai/react";

const { messages, sendMessage, addToolOutput, status, error, stop } =
  useChat<InterviewAgentMessage>({
    // 当所有 client-side tool 都有输出时，自动发起下一轮请求
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

// 用户选择选项时的处理函数
const handleOptionSelect = useCallback(
  (toolCallId: string, selectedOption: string, targetField: string) => {
    addToolOutput({
      tool: "presentOptions",
      toolCallId,
      output: JSON.stringify({ selected: selectedOption, targetField }),
    });
    // 不需要 dispatch、不需要手动 sendMessage
    // sendAutomaticallyWhen 会自动触发下一轮
  },
  [addToolOutput],
);
```

### Step 3：服务端从消息历史重建状态

**文件**：`features/learning/agents/interview/agent.ts`

```typescript
import { ToolLoopAgent } from "ai";

export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: interviewModel,
  tools: interviewTools,
  maxOutputTokens: 4096,

  // prepareCall：请求级配置（只做一次）
  prepareCall: ({ messages, ...rest }) => {
    // 从消息历史中提取已收集的维度
    const context = extractContextFromMessages(messages);
    const instructions = buildInterviewPrompt(context);

    const hasAllInfo =
      Boolean(context.goal) &&
      Boolean(context.background) &&
      Boolean(context.targetOutcome) &&
      Boolean(context.cognitiveStyle);

    if (hasAllInfo) {
      return {
        ...rest,
        instructions,
        temperature: 0.7,
        toolChoice: { type: "tool", toolName: "generateOutline" },
        stopWhen: stepCountIs(1),
      };
    }

    return {
      ...rest,
      instructions,
      temperature: 0.7,
      // presentOptions 没有 execute，循环会自然停止
      // 不需要 stopWhen hack
    };
  },
});

/**
 * 从消息历史中提取用户已提供的信息
 * presentOptions 的 tool output 里包含用户的选择
 */
function extractContextFromMessages(messages: unknown[]): InterviewContext {
  const context: InterviewContext = {
    goal: "",
    background: "",
    targetOutcome: "",
    cognitiveStyle: "",
  };

  // 遍历消息，找所有 presentOptions 的 tool output
  for (const msg of messages) {
    // 根据 UIMessage 结构解析 tool parts
    // 每个 presentOptions 的 output 包含 { selected, targetField }
    // 将 selected 值写入对应的 context 字段
  }

  return context;
}
```

### Step 4：简化 ChatInterface

**文件**：`features/learning/components/create/ChatInterface.tsx`

```typescript
// 从 message parts 中找 presentOptions tool call
// 当 state === "input-available" 时渲染选项按钮
// 点击时调用 handleOptionSelect(toolCallId, option, targetField)

{lastMessage?.parts?.map((part) => {
  if (
    part.type === "tool-presentOptions" &&
    part.state === "input-available"
  ) {
    return (
      <div key={part.toolCallId} className="flex flex-wrap gap-3">
        {part.input.options.map((option) => (
          <button
            key={option}
            onClick={() => handleOptionSelect(part.toolCallId, option, part.input.targetField)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }
  return null;
})}
```

### Step 5：删除不再需要的代码

- `useCourseGeneration.ts` 中的 `useReducer` context 管理（状态改由消息历史承载）
- `handleSendMessage` 中的 `contextUpdate` / `dispatch` 逻辑
- `sendMessage` 的 `body.interviewContext` 传递
- API route 中的 `interviewContext` 解析和 options 构造
- `stopWhen: stepCountIs(1)` 临时补丁
- `processedToolCallIds` ref（SDK 自动处理去重）
- auto-resume useEffect（SDK 的 `sendAutomaticallyWhen` 替代）

---

## 四、Agent（ToolLoopAgent 自治循环）适合用在哪里

### 判断标准

| 特征 | 适合 Agent 自治循环 | 适合 Human-in-the-loop |
|------|-------------------|----------------------|
| 是否需要用户输入 | 不需要 | 需要 |
| 工具是否有副作用需确认 | 无/可逆 | 有/不可逆 |
| 任务是否可以一次性完成 | 是 | 否 |
| 错误成本 | 低 | 高 |

### 你项目中的三个 Agent 场景

#### 1. Course Generation Agent — 适合自治循环 ✅

**文件**：`features/learning/agents/course-generation/agent.ts`

```
用户确认大纲 → 后台自动生成所有章节内容 → 保存到数据库
```

- 不需要用户参与每章的生成
- `saveChapterContent` 是服务端工具，有 `execute`
- 循环直到所有章节生成完毕
- **当前实现是正确的**，`stopWhen` 检测 `saveChapterContent` 调用完成

#### 2. Chat Agent（搜索/编辑）— 适合自治循环 ✅

```
用户提问 → AI 搜索 → AI 整理答案 → 返回
用户说"修改标题" → AI 调用 editDocument → 完成
```

- 工具（searchWeb、editDocument）都是服务端自主执行
- 不需要中间确认
- `stepCountIs(3)` 合理

#### 3. Interview Agent — 不适合自治循环 ❌

```
AI 问问题 → 等用户选 → AI 问下一个 → 等用户选 → ...
```

- 每一步都需要用户输入
- 应该用 client-side tool（无 execute）
- 每次 agent 只执行到 `presentOptions` 就自动停止

### 总结：何时用 `execute`，何时不用

```
工具需要人参与？
  ├── 是 → 不写 execute（client-side tool）
  │        例：presentOptions, confirmAction, askForFeedback
  │        效果：agent 循环自动暂停，等 addToolOutput
  │
  └── 否 → 写 execute（server-side tool）
           例：generateOutline, saveChapterContent, searchWeb, editDocument
           效果：服务端自动执行，agent 循环继续
```

---

## 五、改造前后对比

### 改造前

```
sendMessage("你是谁", { body: { interviewContext: {...} } })
  → 服务端 prepareCall（一次性配置）
  → agent 循环开始
  → presentOptions.execute() → { status: "ui_rendered" }  // agent 以为搞定了
  → 继续循环 → presentOptions → presentOptions → presentOptions → generateOutline
  → 一口气全部完成，用户没有参与机会
```

### 改造后

```
sendMessage("你是谁")
  → 服务端 prepareCall
  → agent 调用 presentOptions（无 execute → 循环自动停止）
  → 客户端渲染选项，等用户点击
  → 用户点击 → addToolOutput → sendAutomaticallyWhen 触发下一轮
  → 服务端从消息历史提取已收集信息
  → agent 调用 presentOptions → 又停止 → 等用户
  → ...四轮对话后...
  → 所有信息收集完毕 → agent 调用 generateOutline（有 execute → 自动完成）
  → 客户端收到大纲 → 进入 outline_review
```

---

## 六、需要注意的点

1. **`addToolOutput` 的 output 是字符串**，需要 `JSON.stringify`
2. **`sendAutomaticallyWhen`** 需要从 `ai/react` 导入内置函数 `lastAssistantMessageIsCompleteWithToolCalls`
3. **消息历史会变长**（每轮多一对 tool call + tool output），注意 token 管理
4. **localStorage 持久化逻辑可以简化**，因为 `UIMessage[]` 自带完整状态
5. **`extractContextFromMessages` 需要处理 UIMessage 的 parts 结构**，不同于旧的 flat message

---

## 七、涉及文件清单

| 文件 | 改动 |
|------|------|
| `features/learning/tools/interview.ts` | `presentOptions` 删除 `execute` |
| `features/learning/agents/interview/agent.ts` | 重写 `prepareCall`，删除 side-channel context，加 `extractContextFromMessages` |
| `features/learning/hooks/useCourseGeneration.ts` | 用 `addToolOutput` + `sendAutomaticallyWhen` 替代手动状态管理 |
| `features/learning/components/create/ChatInterface.tsx` | 从 message parts 读 tool state，调 `handleOptionSelect` |
| `app/api/chat/route.ts` | INTERVIEW case 删除 `interviewContext` 解析，直接传 `uiMessages` |
| `features/shared/ai/prompts/interview.ts` | 无需改动（prompt 逻辑不变） |

---

## 参考资料

- [AI SDK v6 Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control) — `stopWhen`, `prepareStep`
- [AI SDK Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) — client-side tools, `addToolOutput`
- [AI SDK Human-in-the-Loop](https://ai-sdk.dev/cookbook/next/human-in-the-loop) — `needsApproval`, interactive patterns
- [AI SDK v6 Announcement](https://vercel.com/blog/ai-sdk-6) — 架构概览

# Next.js 16 + AI SDK v6 现代化最佳实践

> **2026 推荐**: 使用 Agent 模式 (`createAgentUIStreamResponse` + `ToolLoopAgent`)，比基础 `streamText` 更先进

## 依赖配置

### 三个核心包
```json
{
  "ai": "^6.0.0",              // 核心包 - 流式响应、消息转换
  "@ai-sdk/react": "^3.0.0",   // React Hook - useChat/useCompletion
  "@ai-sdk/provider": "^3.0.0"  // Provider - 模型提供商抽象
}
```

### 额外依赖 (内容渲染)
```json
{
  "react-markdown": "^10.0.0",  // Markdown 渲染
  "remark-gfm": "^4.0.0",       // GitHub Flavored Markdown
  "@tiptap/core": "3.20.0"     // 官方 JSONContent 类型
}
```

### 安装
```bash
pnpm add ai @ai-sdk/react @ai-sdk/provider react-markdown remark-gfm
```

---

## 三层架构

### 1. @ai-sdk/provider - 模型提供商
```typescript
// features/ai/provider/index.ts
import { createProvider } from "@ai-sdk/provider";
import { 
  createOpenAICompatible, 
  // 或其他 provider
} from "@ai-sdk/openai-compatible";

// 302.ai 配置
export const aiProvider = createProvider({
  provider: createOpenAICompatible({
    name: "302.ai",
    baseURL: "https://api.302.ai/gpt",
    apiKey: process.env.AI_302_API_KEY,
    // headers: {
    //   "Authorization": `Bearer ${process.env.AI_302_API_KEY}`
    // }
  }),
});

// 使用
const model = aiProvider.languageModel("gpt-4o");
```

### 2. ai - 核心流式处理
```typescript
// features/ai/provider/index.ts
import { convertToModelMessages, smoothStream } from "ai";

// API 端点使用
import { streamText } from "ai";
import { convertToModelMessages } from "ai";

// POST handler
const result = await streamText({
  model,
  messages: convertToModelMessages(messages),
  system: "你是一个有用的助手",
});

// 返回流式响应
return result.toUIMessageStreamResponse();
```

---

## Agent 模式 (2026 推荐)

> 相比基础 `streamText`，Agent 模式更先进：一次定义、多处使用、自动工具循环、类型安全

### 1. 定义 Agent (features/ai/agents/)
```typescript
// features/ai/agents/index.ts
import { ToolLoopAgent, tool, infer as tool } from "ai";
import { aiProvider } from "../provider";

// 定义工具
const weatherTool = tool({
  description: "获取天气信息",
  parameters: z.object({
    location: z.string().describe("城市名称"),
  }),
  execute: async ({ location }) => {
    // 实际调用天气 API
    return { temperature: 20, condition: "晴天" };
  },
});

// 创建 Agent
export const chatAgent = new ToolLoopAgent({
  model: aiProvider.chatModel,
  instructions: "你是一个有用的 AI 助手",
  tools: {
    weather: weatherTool,
  },
  // 可选：循环控制
  stopWhen: stepCountIs(20), // 最多 20 步
});

// 导出类型供前端使用
export type ChatAgentUIMessage = InferAgentUIMessage<typeof chatAgent>;
```

### 2. API 端点使用 (app/api/chat/route.ts)
```typescript
// app/api/chat/route.ts
import { createAgentUIStreamResponse, smoothStream } from "ai";
import { NextRequest } from "next/server";
import { getAgent } from "@/features/ai/agents";

export async function POST(request: NextRequest) {
  const { messages, intent, sessionId } = await request.json();
  
  const agent = getAgent(intent, sessionId); // 根据 intent 获取不同 Agent
  
  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    }),
  });

  return response;
}
```

### 3. @ai-sdk/react - 前端 Hook
```tsx
// 组件中使用
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type TextUIPart } from "ai";

// v6: input/setInput 不再由 useChat 返回，需要自行管理
const [input, setInput] = useState("");

const chat = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: { intent: "CHAT" },
  }),
});

// 提取属性
const messages = chat.messages;
const sendMessage = chat.sendMessage;
// v6 status: 'submitted' | 'streaming' | 'ready' | 'error'
const status = chat.status;

// 从 message.parts 提取文本内容 (v6 使用 parts 而非 content)
function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is TextUIPart => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// 发送消息
await sendMessage({ text: input.trim() });
```

---

## 完整数据流

```
用户输入 
    ↓
@ai-sdk/react useChat
    ↓
DefaultChatTransport → POST /api/chat
    ↓
Next.js API Route (route.ts)
    ↓
@ai-sdk/provider (模型)
    ↓
ai streamText() + convertToModelMessages()
    ↓
toUIMessageStreamResponse()
    ↓
流式返回
    ↓
useChat 自动更新 messages
    ↓
渲染 UI
```

---

## API 端点最佳实践

```typescript
// app/api/chat/route.ts
import { convertToModelMessages, smoothStream } from "ai";
import { NextRequest } from "next/server";
import { aiProvider } from "@/features/ai/provider";

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  
  const model = aiProvider.languageModel("gpt-4o");
  
  const result = await streamText({
    model,
    messages: convertToModelMessages(messages),
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    }),
  });

  return result.toUIMessageStreamResponse();
}
```

---

## 前端组件最佳实践

```tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export function ChatComponent() {
  const [input, setInput] = useState("");

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ intent: "CHAT" }), // 动态 body
    }),
  });

  const messages = chat.messages;
  const sendMessage = chat.sendMessage;
  const status = chat.status;
  
  const isLoading = status === "submitted" || status === "streaming";

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {getTextContent(msg)}
        </div>
      ))}
      
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
    </div>
  );
}

function getContent(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("");
  }
  return JSON.stringify(msg.content);
}
```

---

## 常见问题

### 1. 发送消息格式
```tsx
// ✅ 正确
await sendMessage({ text: "hello" });

// ❌ 错误
await sendMessage("hello");
await sendMessage({ role: "user", content: "hello" });
```

### 2. 获取输入状态
```tsx
// ✅ v6 正确方式 - useChat 不再返回 input/setInput
const [input, setInput] = useState("");

// ❌ 不要这样 - v5 旧方式
const { input, setInput } = useChat();
```

### 3. 加载状态判断
```tsx
// ✅ 正确 - v6 status 有4个值: 'submitted' | 'streaming' | 'ready' | 'error'
const isLoading = status === "submitted" || status === "streaming";

// ❌ 旧方式
const isLoading = status === "submitted" || status === "ready";
```

### 4. 消息内容渲染 (Markdown)
```tsx
// ✅ 使用 react-markdown 渲染富文本
import { MarkdownRenderer } from "./MarkdownRenderer";

// 消息渲染
{msg.role === "user" ? (
  getTextContent(msg)
) : (
  <MarkdownRenderer content={getTextContent(msg)} />
)}
```

### 5. 结构化内容生成 (Tiptap JSON)
```typescript
// features/ai/types/index.ts
import type { JSONContent } from "@tiptap/core";
import { z } from "zod";

// 定义闪卡 Schema
export const FlashcardSchema = z.object({
  cards: z.array(z.object({
    front: z.string(),
    back: z.string(),
  })),
});

// 使用 streamObject 生成结构化内容
import { streamObject } from "ai";

const result = await streamObject({
  model: aiProvider.chatModel,
  schema: FlashcardSchema,
  prompt: "创建关于 React 的 5 个闪卡",
});

// result.object 包含类型安全的结构化数据
const { cards } = result.object;
```

---

## 文件位置

- Provider: `features/ai/provider/index.ts`
- Agent: `features/ai/agents/index.ts`
- Types: `features/ai/types/index.ts`
- API: `app/api/chat/route.ts`
- 组件: `features/home/components/HeroInput.tsx`
- Markdown渲染器: `features/home/components/MarkdownRenderer.tsx`
- 文档: `docs/AI-SDK-v6-GUIDE.md`

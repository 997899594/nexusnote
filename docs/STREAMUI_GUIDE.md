# AI SDK v6 - 生成式 UI 模式指南

## 概述

NexusNote 使用 Vercel AI SDK v6 的多种模式实现 AI 驱动的 UI 生成。

> **注意**：`streamUI`（`ai/rsc`）在 SDK v6 中已**废弃**，RSC 开发已暂停。
> 推荐使用 `streamText` + `useChat` + Tool Invocations 或 `streamObject` + `useObject`。

## 项目中使用的模式

### 模式 A: Tool-First 生成式 UI（主要模式）

**用于**：聊天交互、文档编辑、闪卡创建等

```
Server: streamText() + tools → toUIMessageStreamResponse()
Client: useChat() + message.parts[toolInvocation] → 对应 UI 组件
```

**架构**：
```typescript
// 服务端 - /api/chat/route.ts
const result = streamText({
  model: chatModel,
  tools: { ...skills, ...editorSkills },
  experimental_transform: smoothStream({
    chunking: new Intl.Segmenter('zh-Hans', { granularity: 'word' }),
  }),
})
return result.toUIMessageStreamResponse()

// 客户端 - ChatSidebar.tsx
const { messages } = useChat({ transport })
// 从 message.parts 中提取 tool-invocation 并渲染对应组件
for (const part of message.parts) {
  if (part.type === 'tool-invocation') {
    switch (part.toolName) {
      case 'editDocument': return <EditConfirmCard ... />
      case 'createFlashcards': return <FlashcardCreated ... />
    }
  }
}
```

**优点**：
- 客户端完全可交互（确认、取消、编辑）
- 类型安全的工具调用和结果
- 易于调试

---

### 模式 B: 流式结构化输出（文档生成）

**用于**：生成结构化数据（大纲、列表），需要实时渐进渲染

```
Server: streamObject() → toTextStreamResponse()
Client: useObject() → partial object → 渐进渲染 UI
```

**架构**：
```typescript
// 服务端 - /api/generate-doc/route.ts
const result = streamObject({
  model: chatModel,
  schema: DocumentSchema,  // z.object({ outline: z.array(ChapterSchema) })
  prompt: `主题：${topic}`,
})
return result.toTextStreamResponse()

// 客户端 - useDocumentGeneration.ts
const { submit, object, isLoading } = useObject({
  api: '/api/generate-doc',
  schema: DocumentSchema,
})
// object 是 DeepPartial<DocumentOutline>
// 章节逐个出现，内容渐进填充
```

**优点**：
- 结构化输出，自动 schema 校验
- 实时 partial object 更新（章节逐个出现）
- 支持 stop/clear 操作

---

## 模式选择指南

| 需求 | 推荐模式 |
|------|----------|
| 需要用户交互（确认、编辑） | **模式 A**: Tool-First |
| 生成结构化数据（大纲、列表） | **模式 B**: streamObject |
| 多步骤 Agent 工作流 | **模式 A**: Tool-First + maxSteps |
| 简单文本对话 | **模式 A**: streamText（无 tools） |

## AI SDK v6 关键特性

### smoothStream（CJK 优化）
```typescript
experimental_transform: smoothStream({
  chunking: new Intl.Segmenter('zh-Hans', { granularity: 'word' }),
})
```
使用 `Intl.Segmenter` 按中文词语边界分割流式输出，避免字符被截断。

### DefaultChatTransport
```typescript
const transport = new DefaultChatTransport({ api: '/api/chat' })
const { messages } = useChat({ transport })
```

### stepCountIs（替代 maxSteps）
```typescript
streamText({ stopWhen: stepCountIs(3) })
```

## 参考资源

- [AI SDK v6 Documentation](https://ai-sdk.dev/docs)
- [Generative UI Guide](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [useObject Hook](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-object)
- [smoothStream](https://ai-sdk.dev/docs/reference/ai-sdk-core/smooth-stream)

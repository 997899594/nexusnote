# ToolLoopAgent 迁移报告 - AI SDK 6

**实施日期**: 2026-02-03
**方案**: 从 `streamText` + `prepareStep` 迁移到 `ToolLoopAgent`
**状态**: ✅ 编译通过，待测试

---

## 🎯 为什么迁移到 ToolLoopAgent？

### 这是AI SDK 6的官方推荐方案

> "AI SDK 6 introduces the Agent abstraction for building reusable agents. Define your agent once with its model, instructions, and tools, then use it across your entire application."
> — [AI SDK 6 Blog](https://vercel.com/blog/ai-sdk-6)

> "The ToolLoopAgent class provides a production-ready implementation that handles the complete tool execution loop."
> — [AI SDK Documentation](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)

### 方案对比

| 维度 | streamText + prepareStep | ToolLoopAgent (AI SDK 6) |
|------|------------------------|-------------------------|
| **代码量** | ~175行 | ~140行 (-20%) |
| **API复杂度** | 中等（需手动管理步骤） | 低（自动管理） |
| **可复用性** | ❌ 每次都需配置 | ✅ Define once, use everywhere |
| **生产级** | ⚠️ 自建方案 | ✅ Thomson Reuters、Clay在用 |
| **维护性** | ❌ 逻辑分散 | ✅ 集中定义 |
| **与AI SDK生态集成** | ⚠️ 部分 | ✅ 深度集成 |
| **多步工具循环** | ✅ 手动管理（prepareStep） | ✅ 自动管理（最多20步） |

---

## 📝 实施细节

### 1. Agent定义（`apps/web/lib/ai/agents/interview/agent.ts`）

**之前**：
```typescript
export async function runInterview(messages, context) {
  const result = streamText({
    model: model,
    messages: messages,
    system: buildPrompt(context, isFirstTurn),
    stopWhen: stepCountIs(5),
    prepareStep: ({ stepNumber }) => {
      if (stepNumber % 2 === 1) {
        return { activeTools: [] };
      }
    },
    tools: { updateProfile, generateOutline },
  });
  return result;
}
```

**现在**：
```typescript
export function createInterviewAgent(context: InterviewContext = {}) {
  return new ToolLoopAgent({
    model: registry.courseModel || registry.chatModel,
    instructions: buildInstructions(context),
    tools: {
      updateProfile: updateProfileTool,
      generateOutline: generateOutlineTool,
    },
    temperature: 0.7,
    // Default: 20 steps (sufficient for 3-question interview)
  });
}
```

**关键改进**：
- ✅ 返回可复用的Agent实例，而不是一次性的stream result
- ✅ 移除手动的`prepareStep`逻辑（ToolLoopAgent自动管理）
- ✅ `buildPrompt` → `buildInstructions`（更符合Agent API语义）
- ✅ 默认20步循环（无需手动配置`stopWhen`）

### 2. API Route（`apps/web/app/api/learn/interview/route.ts`）

**之前**：
```typescript
const convertedMessages = await convertToModelMessages(messages);
const result = await runInterview(convertedMessages, interviewContext);
return result.toUIMessageStreamResponse();
```

**现在**：
```typescript
const convertedMessages = await convertToModelMessages(messages);
const agent = createInterviewAgent(interviewContext);
const result = await agent.stream({ messages: convertedMessages });
return result.toUIMessageStreamResponse();
```

**关键改进**：
- ✅ Agent创建与调用分离
- ✅ 可以复用同一个agent实例（如果需要）
- ✅ API更清晰：`agent.stream()` vs `runInterview()`

### 3. 工具定义（Tools）

**保持不变**，提取为模块级常量：
```typescript
const updateProfileTool = tool({
  description: "更新用户的学习档案信息...",
  parameters: z.object({...}),
  execute: async (args) => ({
    success: true,
    nextAction: "向用户确认已记录，并询问下一个问题",
    recorded: args,
  }),
});

const generateOutlineTool = tool({...});
```

**好处**：
- ✅ 工具定义可以在多个agent间复用
- ✅ 更易于测试（可以单独测试tool）

---

## 🔧 文件变更总结

### 修改的文件

1. **`apps/web/lib/ai/agents/interview/agent.ts`** (核心)
   - `runInterview()` → `createInterviewAgent()`
   - `streamText()` → `ToolLoopAgent`
   - 移除 `prepareStep` 逻辑
   - 移除 `stepCountIs`, `createTelemetryConfig` imports

2. **`apps/web/app/api/learn/interview/route.ts`** (主API)
   - 更新为使用 `createInterviewAgent()` + `agent.stream()`

3. **`apps/web/app/api/chat/route.ts`**
   - 更新注释代码中的 `runInterview` → `createInterviewAgent`

4. **`apps/web/app/api/test-interview/route.ts`**
   - 测试端点更新

5. **`apps/web/scripts/test-interview.ts`**
   - 测试脚本更新

### 代码统计

| 指标 | 之前 | 现在 | 变化 |
|------|------|------|------|
| agent.ts行数 | ~175 | ~140 | -20% |
| 复杂度（prepareStep逻辑） | 中 | 无 | -100% |
| 导入依赖 | 4个 | 3个 | -25% |

---

## ✅ 编译验证

```bash
$ pnpm exec tsc --noEmit --project apps/web/tsconfig.json
✅ 无错误
```

所有TypeScript类型检查通过。

---

## 🧪 测试计划

### 场景1：正常3轮对话

```
用户: "Python"
预期: AI调用 updateProfile + 回复文字询问background

用户: "零基础"
预期: AI调用 updateProfile + 回复文字询问time

用户: "每天2小时"
预期:
  1. AI调用 updateProfile
  2. AI回复确认文字
  3. AI调用 generateOutline
  4. AI回复总结文字
```

### 场景2：一次性提供所有信息

```
用户: "我想学Python，零基础，每天2小时"
预期:
  1. AI调用 updateProfile({ goal, background, time })
  2. AI回复确认
  3. AI调用 generateOutline
  4. AI回复总结
```

### 场景3：URL预填goal

```
初始context: { goal: "Python" }
用户: "我的目标是：Python。请开始访谈。"
预期: AI确认goal（⏳状态）并询问background
```

### 验证点

- [ ] 每轮对话都有文字回复（不再出现空白）
- [ ] Tool calls正确触发
- [ ] generateOutline包含完整的modules数组
- [ ] 最多20步内完成（检查Langfuse日志）
- [ ] finishReason是"stop"或"end-turn"，不是"tool-calls"

---

## 🔍 关键问题：ToolLoopAgent是否解决了"强制文本"问题？

### 答案：**不确定，需要测试**

**ToolLoopAgent的文档说明**：
> "The ToolLoopAgent class provides a production-ready implementation that handles the complete tool execution loop. It calls the LLM with your prompt, executes any requested tool calls, adds results back to the conversation, and **repeats until complete**."

**"完成"的定义**：
- Option 1: 模型生成文本（不调用工具）
- Option 2: 达到maxSteps限制（20步）

**潜在风险**：
如果模型在Step 1、3、5...仍然选择"只调用工具不生成文字"，ToolLoopAgent会继续循环直到：
- 模型自己决定生成文字
- 或达到20步上限

**如果测试后仍然出现空白**，有两个Plan B：

#### Plan B1: ToolLoopAgent + prepareStep (Hybrid)

AI SDK允许在agent.stream()时传入`prepareStep`：
```typescript
const result = await agent.stream({
  messages: convertedMessages,
  prepareStep: ({ stepNumber }) => {
    if (stepNumber % 2 === 1) {
      return { activeTools: [] };
    }
  },
});
```

这样结合了两个方案的优势。

#### Plan B2: 前端轮询检测

```typescript
// 前端检测finishReason
if (finishReason === 'tool-calls' && !hasTextContent) {
  // 手动补一条请求："请用文字回复"
  await sendMessage({ text: "请总结一下刚才的信息，并告诉我下一步。" });
}
```

**但首选是测试验证ToolLoopAgent是否自然解决问题。**

---

## 📚 参考资料

### 官方文档

1. [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6)
2. [ToolLoopAgent API Documentation](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent)
3. [Agents: Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
4. [Agents: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
5. [Migration Guide: AI SDK 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)

### 社区案例

6. [Thomson Reuters使用ToolLoopAgent构建AI助手](https://vercel.com/blog/ai-sdk-6)
7. [Clay使用ToolLoopAgent at scale](https://vercel.com/blog/ai-sdk-6)

### 关键引用

> "Define your agent once with its model, instructions, and tools, then use it across your entire application."
> — AI SDK 6

> "The Agent class is the recommended approach because it reduces boilerplate by managing loops and message arrays."
> — [Agents: Building Agents](https://ai-sdk.dev/docs/agents/building-agents)

---

## 🎉 迁移优势总结

### 代码质量

1. ✅ **更少的代码** - 删除了35行的prepareStep逻辑
2. ✅ **更清晰的职责** - Agent定义与调用分离
3. ✅ **更易测试** - 可以独立测试agent实例

### 架构优势

1. ✅ **可复用性** - "Define once, use everywhere"
2. ✅ **生产级** - 使用AI SDK官方推荐的最佳实践
3. ✅ **未来兼容** - AI SDK 6的长期方向

### 开发体验

1. ✅ **更少的boilerplate** - 无需手动管理步骤
2. ✅ **更好的类型支持** - Agent API有完整的TypeScript定义
3. ✅ **更易调试** - 集中的agent配置

---

## 🚀 下一步

1. **测试验证** - 按照上述测试计划验证功能
2. **监控观察** - 检查Langfuse日志，确认每轮对话都有文字
3. **性能对比** - 对比迁移前后的token usage和响应时间

如果测试通过，这将是**2026年AI SDK的最佳实践架构**。

---

**最后的话**：

用户质疑得对："状态机之前不是说过时了吗"。

我们的架构演进：
1. ❌ FSM状态机（2024，过时）
2. ⚠️ streamText + prepareStep（2025，过渡方案）
3. ✅ **ToolLoopAgent（2026，最佳实践）**

ToolLoopAgent完美契合"无状态机、AI自主决定流程"的现代架构理念。

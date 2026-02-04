# NexusNote 优化计划

> 基于 AI SDK v6 文档分析
> 2026-02-04

## 📊 优先级分类

### 🔥 高优先级（立即可用，收益明显）

#### 1. 类型守卫替换 `any` 类型

**当前问题：**
```typescript
// ChatInterface.tsx:206
const lastMessage = messages[messages.length - 1] as any;
if (!lastMessage.parts) return;

// getToolParts 函数
.filter((p: any) => p.type?.startsWith('tool-'))
```

**优化方案：**
```typescript
import { isTextUIPart, isToolUIPart, getToolName } from 'ai';

// ✅ 类型安全
message.parts.forEach((part) => {
  if (isTextUIPart(part)) {
    console.log('文本:', part.text);  // TypeScript 知道 part.text 存在
  }

  if (isToolUIPart(part)) {
    const toolName = getToolName(part);
    console.log('工具:', toolName, part.input);
  }
});
```

**收益：**
- ✅ 完全的类型安全
- ✅ 更好的 IDE 自动补全
- ✅ 编译时错误检测
- ✅ 代码更清晰

**工作量：** 30 分钟

---

#### 2. smoothStream - 中文逐字输出

**当前问题：**
- 流式输出可能一次出现大段中文文字
- 用户体验不够丝滑

**优化方案：**
```typescript
// app/api/ai/route.ts
import { smoothStream } from 'ai';

return interviewAgent.toUIMessageStreamResponse({
  request: req,
  messages: messages,
  options: interviewContext,

  // 添加流式优化
  experimental_transform: smoothStream({
    delayInMs: 30,  // 30ms 一个字符
    chunking: new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }),
  }),
});
```

**效果对比：**
```
❌ 当前：你好，欢迎使用 NexusNote！我们将为你定制...（一次性出现）

✅ 优化后：你 → 好 → ， → 欢 → 迎 → 使 → 用 ...（逐字流出）
```

**收益：**
- ✅ 极大提升用户体验
- ✅ 符合 ChatGPT 等产品的体验标准
- ✅ 中文友好

**工作量：** 10 分钟

---

#### 3. stopCondition - 防止 Agent 无限循环

**当前问题：**
- Agent 没有步骤限制
- 理论上可能陷入无限循环（虽然概率低）

**优化方案：**
```typescript
import { stepCountIs, hasToolCall } from 'ai';

// 方案 1: 限制最大步骤数
return interviewAgent.toUIMessageStreamResponse({
  // ...
  maxSteps: 10,  // 最多 10 步
});

// 方案 2: 检测到特定工具调用后停止
// （在 Agent 定义中使用）
export const interviewAgent = new ToolLoopAgent({
  // ...
  onStepFinish: async (stepResult) => {
    // 如果调用了 generateOutline，记录并准备停止
    if (stepResult.toolCalls.some(tc => tc.toolName === 'generateOutline')) {
      console.log('[Agent] ✅ generateOutline called, stopping after this step');
    }
  },
});
```

**收益：**
- ✅ 防止意外的无限循环
- ✅ 节省成本
- ✅ 更可控的行为

**工作量：** 15 分钟

---

#### 4. addToolInputExamplesMiddleware - 提升工具调用准确性

**当前问题：**
- AI 可能不清楚如何正确调用工具
- 需要依赖 Prompt 描述

**优化方案：**
```typescript
// lib/ai/tools/interview.ts
import { tool } from 'ai';

export const presentOptionsTool = tool({
  description: '展示选项卡片',
  inputSchema: z.object({
    question: z.string(),
    options: z.array(z.string()),
    targetField: z.enum(['goal', 'background', 'time', 'general']),
  }),

  // ✅ 添加示例
  inputExamples: [
    {
      question: '选择方向',
      options: ['Web开发', '移动开发', 'AI开发', '数据科学'],
      targetField: 'goal',
    },
    {
      question: '您的水平',
      options: ['零基础', '有基础', '有经验', '专业级'],
      targetField: 'background',
    },
  ],

  execute: async (params) => {
    return { status: 'ui_rendered' };
  },
});

// lib/ai/registry.ts
import { wrapLanguageModel, addToolInputExamplesMiddleware } from 'ai';

export const chatModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: addToolInputExamplesMiddleware({
    prefix: '示例调用：',
    format: (example, index) => `${index + 1}. ${JSON.stringify(example.input, null, 2)}`,
  }),
});
```

**收益：**
- ✅ AI 更准确地理解工具用法
- ✅ 减少工具调用错误
- ✅ 不需要在 Prompt 中手动写示例

**工作量：** 20 分钟

---

#### 5. extractReasoningMiddleware - 显示 AI 思考过程

**当前问题：**
- 用户看不到 AI 为什么这样设计课程
- 缺乏透明度

**优化方案：**
```typescript
// lib/ai/registry.ts
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';

export const chatModelWithReasoning = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: extractReasoningMiddleware({
    tagName: 'thinking',
    separator: '\n\n---\n\n',
    startWithReasoning: false,  // 先回复，再显示推理
  }),
});

// lib/ai/agents/interview/agent.ts
export const interviewAgent = new ToolLoopAgent({
  model: chatModelWithReasoning,  // 使用带推理的模型
  // ...
});
```

**UI 展示：**
```tsx
// components/create/ChatInterface.tsx
import { isReasoningUIPart } from 'ai';

{message.parts.map((part, i) => {
  if (isReasoningUIPart(part)) {
    return (
      <details key={i} className="mb-4">
        <summary className="cursor-pointer text-sm text-black/40 hover:text-black/60">
          💭 查看 AI 思考过程
        </summary>
        <pre className="bg-black/5 p-4 rounded-[16px] mt-2 text-xs text-black/60 leading-relaxed">
          {part.text}
        </pre>
      </details>
    );
  }
})}
```

**效果：**
```
AI 回复：好的！我将为你设计一个 Python Web 开发课程。

[折叠] 💭 查看 AI 思考过程
  ↓ 展开后显示：

  用户是零基础，需要从基础语法开始。
  时间是每周 10 小时，可以设计 8 周的课程。
  重点应该放在实战项目上，理论占 30%，实践占 70%。
  模块安排：基础语法 → Flask 框架 → 数据库 → 项目实战。
```

**收益：**
- ✅ 增强用户信任
- ✅ 教育性价值（用户了解 AI 如何思考）
- ✅ 调试友好（开发时可以看到 AI 决策过程）

**工作量：** 30 分钟

---

### ⚡ 中优先级（需要一定重构，收益明显）

#### 6. pruneMessages - 长对话优化

**当前问题：**
- 如果用户反复修改需求，对话会很长
- 发送所有历史消息会浪费 token

**优化方案：**
```typescript
// hooks/useCourseGeneration.ts
import { pruneMessages, convertToModelMessages } from 'ai';

const handleSendMessage = useCallback(
  async (text: string, contextUpdate?: Partial<InterviewContext>) => {
    const finalContext = contextUpdate
      ? { ...context, ...contextUpdate }
      : context;

    if (contextUpdate) {
      dispatch({ type: 'UPDATE_CONTEXT', payload: contextUpdate });
    }

    // ✅ 修剪消息（只在消息超过 10 条时）
    let messagesToSend = messages;
    if (messages.length > 10) {
      const modelMessages = convertToModelMessages(messages);
      const prunedMessages = pruneMessages({
        messages: modelMessages,
        reasoning: 'none',  // 推理过程用户看不到，删除
        toolCalls: 'before-last-5-messages',  // 只保留最近 5 条的工具调用
        emptyMessages: 'remove',
      });
      // 转换回 UIMessage 格式（如果需要）
      messagesToSend = prunedMessages;
    }

    sendMessage(
      { text },
      {
        body: {
          context: {
            explicitIntent: 'INTERVIEW',
            interviewContext: finalContext,
            isInInterview: true,
          },
        },
      }
    );
  },
  [context, messages, sendMessage]
);
```

**收益：**
- ✅ 节省 token（可节省 40-60%）
- ✅ 降低成本
- ✅ 提升响应速度

**工作量：** 45 分钟

---

#### 7. output.object() - 结构化内容生成

**当前问题：**
- `generateOutline` 工具返回的是 JSON
- 没有强类型保证

**优化方案：**
```typescript
// 在课程内容生成阶段使用 output.object()
import { generateText, output } from 'ai';

// 生成单个章节内容
const chapterContentSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
    codeExamples: z.array(z.object({
      language: z.string(),
      code: z.string(),
      explanation: z.string(),
    })).optional(),
  })),
  summary: z.string(),
  exercises: z.array(z.object({
    question: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  })),
});

const result = await generateText({
  model: chatModel,
  prompt: `生成《${chapterTitle}》的详细内容`,
  output: output.object({
    schema: chapterContentSchema,
    name: 'chapterContent',
    description: '章节详细内容',
  }),
});

const chapterContent = result.object;  // 完全类型安全
```

**收益：**
- ✅ 类型安全
- ✅ 自动验证数据结构
- ✅ 更好的错误处理

**工作量：** 1-2 小时

---

#### 8. convertFileListToFileUIParts - 多模态支持

**当前问题：**
- 用户无法上传课程相关的资料（PDF、图片等）

**优化方案：**
```tsx
// components/create/ChatInterface.tsx
import { convertFileListToFileUIParts } from 'ai';
import { Paperclip } from 'lucide-react';

export function ChatInterface({ onSendMessage }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };

  const handleSendWithFiles = async () => {
    if (selectedFiles) {
      const fileParts = await convertFileListToFileUIParts(selectedFiles);

      await onSendMessage(userInput, undefined, {
        parts: [
          { type: 'text', text: userInput },
          ...fileParts,
        ],
      });

      setSelectedFiles(null);
    } else {
      await onSendMessage(userInput);
    }
  };

  return (
    <form onSubmit={handleSendWithFiles}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="p-2 hover:bg-black/5 rounded-full"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* 显示已选文件 */}
      {selectedFiles && (
        <div className="flex gap-2">
          {Array.from(selectedFiles).map((file, i) => (
            <div key={i} className="text-xs bg-black/5 px-2 py-1 rounded">
              {file.name}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
```

**应用场景：**
- 用户上传现有课程大纲 PDF
- 上传参考资料截图
- 上传自己的笔记

**收益：**
- ✅ 更丰富的输入方式
- ✅ AI 可以基于用户资料生成更贴合的课程
- ✅ 差异化功能

**工作量：** 1-2 小时

---

### 🌟 低优先级（未来扩展）

#### 9. embed/embedMany + cosineSimilarity - RAG

**应用场景：**
- 为课程内容建立向量索引
- 用户搜索"如何使用 React Hooks"时，找到相关章节
- 推荐相关课程

**实现思路：**
```typescript
// 课程生成后，为所有章节生成嵌入
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: course.chapters.map(ch => `${ch.title}\n${ch.summary}`),
  maxParallelCalls: 10,
});

// 存储到数据库
await db.insert(chapterEmbeddings).values(
  embeddings.map((emb, i) => ({
    chapterId: course.chapters[i].id,
    embedding: emb,
  }))
);

// 用户搜索时
const { embedding: queryEmb } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: userQuery,
});

// 计算相似度并排序
const results = chapterEmbeddings.map(ch => ({
  ...ch,
  similarity: cosineSimilarity(queryEmb, ch.embedding),
})).sort((a, b) => b.similarity - a.similarity);
```

**收益：**
- ✅ 智能搜索
- ✅ 课程推荐
- ✅ 内容关联

**工作量：** 3-5 小时

---

#### 10. generateImage - 为课程生成配图

**应用场景：**
- 每个章节自动生成插图
- 抽象概念可视化

**实现思路：**
```typescript
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: openai.image('dall-e-3'),
  prompt: `Create an educational illustration for: ${chapter.title}.
           Style: minimalist, clean, professional`,
  size: '1024x1024',
});

// 保存图片 URL 到章节
await db.update(chapters)
  .set({ coverImage: image.url })
  .where(eq(chapters.id, chapter.id));
```

**收益：**
- ✅ 视觉吸引力
- ✅ 学习辅助
- ✅ 产品差异化

**工作量：** 2-3 小时

---

#### 11. generateSpeech - 语音讲解

**应用场景：**
- 每个章节生成语音讲解
- 用户可以"听"课程

**实现思路：**
```typescript
import { generateSpeech } from 'ai';

const { audio } = await generateSpeech({
  model: openai.speech('tts-1-hd'),
  text: chapter.content,
  voice: 'nova',  // 女声，适合教学
  speed: 0.9,  // 稍慢一点，便于学习
});

// 保存音频
const audioUrl = await uploadAudio(audio);
await db.update(chapters)
  .set({ audioUrl })
  .where(eq(chapters.id, chapter.id));
```

**收益：**
- ✅ 无障碍访问
- ✅ 多场景学习（通勤、运动时听）
- ✅ 强大的产品特性

**工作量：** 2-3 小时

---

## 📋 实施计划

### 第一阶段（本周完成）- 快速收益

1. **类型守卫替换（30min）** ✅ 类型安全
2. **smoothStream 中文优化（10min）** ✅ 用户体验
3. **stopCondition 防护（15min）** ✅ 稳定性
4. **addToolInputExamples（20min）** ✅ 工具准确性

**总时间：** 1.5 小时
**收益：** 立竿见影，风险极低

---

### 第二阶段（下周完成）- 体验优化

5. **extractReasoning 透明化（30min）** ✅ 信任度
6. **pruneMessages 成本优化（45min）** ✅ 节省成本

**总时间：** 1.5 小时
**收益：** 显著降低成本，提升透明度

---

### 第三阶段（2 周内）- 功能扩展

7. **output.object 结构化（1-2h）** ✅ 类型安全
8. **多模态文件上传（1-2h）** ✅ 差异化功能

**总时间：** 4 小时
**收益：** 产品竞争力提升

---

### 第四阶段（未来规划）- 高级功能

9. **RAG 搜索推荐（3-5h）**
10. **AI 配图（2-3h）**
11. **语音讲解（2-3h）**

**总时间：** 7-11 小时
**收益：** 产品护城河

---

## 🎯 预期收益总结

| 优化项 | 工作量 | 收益类型 | 影响 |
|--------|--------|----------|------|
| 类型守卫 | 30min | 代码质量 | ⭐⭐⭐⭐ |
| smoothStream | 10min | 用户体验 | ⭐⭐⭐⭐⭐ |
| stopCondition | 15min | 稳定性 | ⭐⭐⭐ |
| toolInputExamples | 20min | AI 准确性 | ⭐⭐⭐⭐ |
| extractReasoning | 30min | 信任度/调试 | ⭐⭐⭐⭐ |
| pruneMessages | 45min | 成本节省 | ⭐⭐⭐⭐ |
| output.object | 1-2h | 类型安全 | ⭐⭐⭐ |
| 文件上传 | 1-2h | 差异化 | ⭐⭐⭐⭐ |
| RAG | 3-5h | 智能化 | ⭐⭐⭐⭐⭐ |
| AI 配图 | 2-3h | 视觉吸引 | ⭐⭐⭐⭐ |
| 语音讲解 | 2-3h | 无障碍 | ⭐⭐⭐⭐⭐ |

---

## 💡 立即行动建议

**今天就做（总计 1.5 小时）：**

1. ✅ 添加 smoothStream（10 分钟）
2. ✅ 替换为类型守卫（30 分钟）
3. ✅ 添加 stopCondition（15 分钟）
4. ✅ 添加工具示例（20 分钟）
5. ✅ 添加推理显示（30 分钟）

完成后，你的项目将：
- 🎨 UI 体验媲美 ChatGPT（中文逐字输出）
- 🔒 代码类型安全（零 `any`）
- 🛡️ 防止无限循环
- 🎯 AI 工具调用更准确
- 💭 用户能看到 AI 思考过程

**ROI 极高！**

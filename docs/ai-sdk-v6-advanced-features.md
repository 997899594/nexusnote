# AI SDK v6 高级功能速查

> 从类型文件挖掘出的实用功能
> 基于 AI SDK 6.0.67

## 目录

1. [消息处理工具](#消息处理工具)
2. [输出格式控制（Output）](#输出格式控制output)
3. [中间件系统（Middleware）](#中间件系统middleware)
4. [停止条件（Stop Conditions）](#停止条件stop-conditions)
5. [流式优化（Stream Optimization）](#流式优化stream-optimization)
6. [类型守卫（Type Guards）](#类型守卫type-guards)
7. [嵌入和向量（Embeddings）](#嵌入和向量embeddings)
8. [多模态功能](#多模态功能)

---

## 消息处理工具

### 1. pruneMessages - 消息修剪

**用途：** 在长对话中，减少 token 使用，移除不必要的历史消息。

```typescript
import { pruneMessages } from 'ai';

const prunedMessages = pruneMessages({
  messages: conversationHistory,

  // 推理内容保留策略
  reasoning: 'all' |                      // 保留所有推理
            'before-last-message' |       // 只保留最后一条消息前的推理
            'none',                       // 移除所有推理

  // 工具调用保留策略
  toolCalls: 'all' |                      // 保留所有工具调用
             'before-last-message' |       // 只保留最后一条消息前的
             'before-last-3-messages' |    // 最后3条消息前的
             'none' |                      // 移除所有
             [                             // 自定义策略
               {
                 type: 'before-last-message',
                 tools: ['search', 'calculator']  // 只保留特定工具
               }
             ],

  // 空消息处理
  emptyMessages: 'keep' | 'remove',
});
```

**实战示例：**

```typescript
// 场景：长对话优化
const { messages, sendMessage } = useChat();

// 发送前修剪历史消息
const handleSend = async (text: string) => {
  const prunedMessages = pruneMessages({
    messages: convertToModelMessages(messages),
    reasoning: 'none',  // 推理过程用户看不到，可以删除
    toolCalls: 'before-last-5-messages',  // 只保留最近5条的工具调用
    emptyMessages: 'remove',
  });

  await sendMessage(text, {
    body: { messages: prunedMessages }
  });
};
```

### 2. convertToModelMessages - 消息格式转换

**用途：** 将 `UIMessage` 转换为 `ModelMessage`（发送给 AI 的格式）。

```typescript
import { convertToModelMessages } from 'ai';

const modelMessages = convertToModelMessages(
  uiMessages,
  {
    tools: myTools,  // 工具定义
    ignoreIncompleteToolCalls: false,  // 是否忽略未完成的工具调用

    // 自定义数据部分转换
    convertDataPart: (part) => {
      if (part.type === 'data-userProfile') {
        return {
          type: 'text',
          text: `User profile: ${JSON.stringify(part.data)}`
        };
      }
      return undefined;  // 忽略此部分
    }
  }
);
```

### 3. convertFileListToFileUIParts - 文件上传

**用途：** 将浏览器的 `FileList` 转换为 `FileUIPart`（用于多模态消息）。

```typescript
import { convertFileListToFileUIParts } from 'ai';

// React 文件上传组件
const FileUpload = () => {
  const { sendMessage } = useChat();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    // 转换文件列表
    const fileParts = await convertFileListToFileUIParts(files);

    // 发送带文件的消息
    sendMessage({
      text: '请分析这些图片',
      parts: [
        { type: 'text', text: '请分析这些图片' },
        ...fileParts,  // 添加文件
      ]
    });
  };

  return <input type="file" multiple onChange={handleFileUpload} />;
};
```

---

## 输出格式控制（Output）

### output.text() - 纯文本输出

```typescript
import { generateText, output } from 'ai';

const result = await generateText({
  model: chatModel,
  prompt: '写一篇文章',
  output: output.text(),  // 明确指定输出文本
});

console.log(result.text);  // string
```

### output.object() - 结构化对象

**用途：** 替代已废弃的 `generateObject`，使用 `generateText` + `output.object()`。

```typescript
import { generateText, output } from 'ai';
import { z } from 'zod';

// 定义 Schema
const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  cookingTime: z.number(),
});

// 生成结构化数据
const result = await generateText({
  model: chatModel,
  prompt: '给我一个番茄炒蛋的食谱',
  output: output.object({
    schema: recipeSchema,
    name: 'recipe',  // 可选：工具名称提示
    description: '中式家常菜食谱',  // 可选：描述
  }),
});

// 类型安全的结果
const recipe = result.object;  // { name: string, ingredients: string[], ... }
console.log(recipe.name);
console.log(recipe.ingredients);
```

### output.array() - 数组输出

```typescript
const result = await generateText({
  model: chatModel,
  prompt: '列出10个编程语言',
  output: output.array({
    element: z.string(),
    name: 'programmingLanguages',
    description: '编程语言列表',
  }),
});

const languages = result.object;  // string[]
```

### output.choice() - 枚举选择

```typescript
const result = await generateText({
  model: chatModel,
  prompt: '这段评论的情感是？："这个产品真棒！"',
  output: output.choice({
    options: ['positive', 'negative', 'neutral'],
    name: 'sentiment',
    description: '情感分析结果',
  }),
});

const sentiment = result.object;  // 'positive' | 'negative' | 'neutral'
```

### output.json() - 非结构化 JSON

```typescript
const result = await generateText({
  model: chatModel,
  prompt: '生成一个用户配置 JSON',
  output: output.json({
    name: 'userConfig',
    description: '用户配置对象',
  }),
});

const config = result.object;  // JSONValue (any JSON)
```

---

## 中间件系统（Middleware）

### extractReasoningMiddleware - 提取推理过程

**用途：** 提取 AI 的"思考过程"（如 o1 模型的推理），单独显示。

```typescript
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';

const modelWithReasoning = wrapLanguageModel({
  model: chatModel,
  middleware: extractReasoningMiddleware({
    tagName: 'thinking',  // XML 标签名
    separator: '\n\n---\n\n',  // 分隔符
    startWithReasoning: true,  // 推理在前，回复在后
  }),
});

const result = await generateText({
  model: modelWithReasoning,
  prompt: '计算 123 * 456',
});

console.log(result.reasoning);  // "Let me break this down..."
console.log(result.text);       // "56088"
```

**UI 示例：**

```tsx
const ChatMessage = ({ message }) => {
  const reasoning = message.parts.find(p => p.type === 'reasoning');
  const text = message.parts.find(p => p.type === 'text');

  return (
    <div>
      {reasoning && (
        <details className="mb-4">
          <summary className="cursor-pointer text-gray-500">
            💭 查看 AI 思考过程
          </summary>
          <pre className="bg-gray-100 p-4 rounded mt-2">
            {reasoning.text}
          </pre>
        </details>
      )}
      <div>{text?.text}</div>
    </div>
  );
};
```

### extractJsonMiddleware - 提取 JSON

**用途：** 从 Markdown 代码块中提取 JSON（处理不规范的模型输出）。

```typescript
import { wrapLanguageModel, extractJsonMiddleware } from 'ai';

const modelWithJsonExtraction = wrapLanguageModel({
  model: chatModel,
  middleware: extractJsonMiddleware({
    transform: (text) => {
      // 自定义转换逻辑
      // 默认：移除 ```json ... ``` 包裹
      return text.replace(/```json\n([\s\S]*?)\n```/g, '$1');
    }
  }),
});

// 即使模型返回 ```json {"name": "test"} ```
// 也能正确解析为 JSON 对象
const result = await generateText({
  model: modelWithJsonExtraction,
  prompt: '生成一个 JSON',
  output: output.json(),
});
```

### addToolInputExamplesMiddleware - 工具示例

**用途：** 将工具的 `inputExamples` 添加到描述中（用于不支持示例的模型）。

```typescript
import { tool, wrapLanguageModel, addToolInputExamplesMiddleware } from 'ai';

const searchTool = tool({
  description: '搜索网络内容',
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.number().optional(),
  }),
  // 添加示例
  inputExamples: [
    { query: 'AI SDK v6 documentation', maxResults: 5 },
    { query: 'Next.js 15 features' },
  ],
  execute: async ({ query }) => { /* ... */ },
});

const modelWithExamples = wrapLanguageModel({
  model: chatModel,
  middleware: addToolInputExamplesMiddleware({
    prefix: '示例输入：',  // 自定义前缀
    format: (example, index) => {
      // 自定义格式化
      return `${index + 1}. ${JSON.stringify(example.input)}`;
    },
    remove: true,  // 添加后移除 inputExamples 属性
  }),
});

// 工具描述会变成：
// "搜索网络内容\n\n示例输入：\n1. {\"query\":\"AI SDK v6 documentation\",\"maxResults\":5}\n2. {\"query\":\"Next.js 15 features\"}"
```

### simulateStreamingMiddleware - 模拟流式

**用途：** 将 `generateText` 的结果模拟成流式输出（用于测试或统一接口）。

```typescript
import { wrapLanguageModel, simulateStreamingMiddleware } from 'ai';

const modelWithSimulatedStreaming = wrapLanguageModel({
  model: chatModel,
  middleware: simulateStreamingMiddleware(),
});

// 即使使用 generateText，也会模拟流式输出
const result = await generateText({
  model: modelWithSimulatedStreaming,
  prompt: 'Hello',
});
```

---

## 停止条件（Stop Conditions）

### stepCountIs - 限制步骤数

**用途：** 限制 Agent 的最大步骤数（防止无限循环）。

```typescript
import { stepCountIs } from 'ai';

const result = await interviewAgent.run({
  prompt: '帮我规划课程',
  stopCondition: stepCountIs(5),  // 最多执行 5 步
});
```

### hasToolCall - 检测工具调用

**用途：** 当调用特定工具时停止 Agent。

```typescript
import { hasToolCall } from 'ai';

const result = await interviewAgent.run({
  prompt: '帮我规划课程',
  stopCondition: hasToolCall('generateOutline'),  // 调用 generateOutline 后停止
});
```

**组合条件：**

```typescript
// 自定义停止条件
const customStopCondition = (stepResult) => {
  // 达到 10 步或调用了 generateOutline
  return stepResult.stepCount >= 10 ||
         stepResult.toolCalls.some(tc => tc.toolName === 'generateOutline');
};
```

---

## 流式优化（Stream Optimization）

### smoothStream - 平滑流式输出

**用途：** 控制流式输出的节奏，提升用户体验（逐字、逐词、逐行）。

```typescript
import { streamText, smoothStream } from 'ai';

const result = await streamText({
  model: chatModel,
  prompt: '写一首诗',
  experimental_transform: smoothStream({
    delayInMs: 10,  // 每个 chunk 之间延迟 10ms

    // 分块策略
    chunking: 'word' |          // 逐词输出（默认，英文友好）
              'line' |          // 逐行输出
              /\s+/ |           // 自定义正则（按空格）
              new Intl.Segmenter('zh-CN', { granularity: 'word' }) |  // 中文分词
              (buffer) => {     // 自定义检测函数
                // 返回第一个检测到的 chunk
                return buffer.match(/[。！？]/)?.[0];
              },
  }),
});
```

**实战示例（中文优化）：**

```typescript
// 使用 Intl.Segmenter 实现中文逐字输出
const result = await streamText({
  model: chatModel,
  prompt: '介绍一下北京',
  experimental_transform: smoothStream({
    delayInMs: 50,  // 50ms 一个字
    chunking: new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }),
  }),
});

// 前端效果：北 → 京 → 是 → 中 → 国 → 的 → 首 → 都 ...
```

---

## 类型守卫（Type Guards）

### 检测消息部分类型

```typescript
import {
  isTextUIPart,
  isToolUIPart,
  isReasoningUIPart,
  isFileUIPart,
  getToolName,
} from 'ai';

message.parts.forEach((part) => {
  if (isTextUIPart(part)) {
    console.log('文本:', part.text);
  }

  if (isReasoningUIPart(part)) {
    console.log('推理:', part.text);
  }

  if (isToolUIPart(part)) {
    const toolName = getToolName(part);  // 'presentOptions'
    console.log('工具调用:', toolName, part.input);
  }

  if (isFileUIPart(part)) {
    console.log('文件:', part.filename, part.url);
  }
});
```

**类型安全的工具处理：**

```typescript
import { isStaticToolUIPart, getStaticToolName } from 'ai';

// 只处理已知的静态工具
if (isStaticToolUIPart(part)) {
  const toolName = getStaticToolName(part);  // keyof typeof tools（类型安全）

  if (toolName === 'presentOptions') {
    // TypeScript 知道 part.input 的类型
    const { question, options } = part.input;
  }
}
```

---

## 嵌入和向量（Embeddings）

### embed - 单个嵌入

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: '人工智能的未来',
});

console.log(embedding);  // number[] (向量)
```

### embedMany - 批量嵌入

```typescript
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: [
    '文档1内容',
    '文档2内容',
    '文档3内容',
  ],
  maxParallelCalls: 5,  // 最多5个并行请求
});

embeddings.forEach((emb, i) => {
  console.log(`文档${i + 1}向量:`, emb);
});
```

### cosineSimilarity - 余弦相似度

```typescript
import { embed, cosineSimilarity } from 'ai';

const { embedding: emb1 } = await embed({
  model: embeddingModel,
  value: '查询文本',
});

const { embedding: emb2 } = await embed({
  model: embeddingModel,
  value: '候选文档',
});

const similarity = cosineSimilarity(emb1, emb2);  // 0.0 - 1.0
console.log('相似度:', similarity);
```

### rerank - 文档重排序

**用途：** 使用专门的 reranking 模型对搜索结果重新排序。

```typescript
import { rerank } from 'ai';
import { cohere } from '@ai-sdk/cohere';

const documents = [
  { id: 1, text: '文档1内容...' },
  { id: 2, text: '文档2内容...' },
  { id: 3, text: '文档3内容...' },
];

const { rankings } = await rerank({
  model: cohere.reranking('rerank-english-v3.0'),
  query: '用户查询',
  documents: documents.map(d => d.text),
  topN: 3,  // 返回前3个
});

// 按相关性排序的结果
rankings.forEach((ranking) => {
  console.log(documents[ranking.index], ranking.score);
});
```

---

## 多模态功能

### generateImage - 图像生成

```typescript
import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';

const { image } = await generateImage({
  model: openai.image('dall-e-3'),
  prompt: '一只戴着墨镜的猫',
  size: '1024x1024',
  n: 1,
  aspectRatio: '16:9',  // 或指定 size
  seed: 12345,  // 可选：固定种子
});

console.log(image.url);  // 图片 URL
console.log(image.base64);  // Base64 数据
```

### generateSpeech - 语音合成

```typescript
import { generateSpeech } from 'ai';
import { openai } from '@ai-sdk/openai';

const { audio } = await generateSpeech({
  model: openai.speech('tts-1'),
  text: '你好，欢迎使用 AI SDK',
  voice: 'alloy',  // alloy, echo, fable, onyx, nova, shimmer
  speed: 1.0,
  outputFormat: 'mp3',
});

// 播放音频
const audioBlob = new Blob([audio], { type: 'audio/mp3' });
const audioUrl = URL.createObjectURL(audioBlob);
const audioElement = new Audio(audioUrl);
audioElement.play();
```

### transcribe - 语音转文字

```typescript
import { transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await transcribe({
  model: openai.transcription('whisper-1'),
  audio: audioFile,  // File 对象或 Uint8Array
});

console.log('转录结果:', text);
```

---

## 实战组合示例

### 1. 带推理过程的结构化输出

```typescript
import { generateText, output, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { z } from 'zod';

const modelWithReasoning = wrapLanguageModel({
  model: chatModel,
  middleware: extractReasoningMiddleware({ tagName: 'thinking' }),
});

const result = await generateText({
  model: modelWithReasoning,
  prompt: '分析这个产品评论："太棒了，性价比高！"',
  output: output.object({
    schema: z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number().min(0).max(1),
      keywords: z.array(z.string()),
    }),
  }),
});

console.log('推理过程:', result.reasoning);
console.log('分析结果:', result.object);
// { sentiment: 'positive', confidence: 0.95, keywords: ['棒', '性价比'] }
```

### 2. 带文件上传的智能对话

```typescript
const ChatWithFiles = () => {
  const { messages, sendMessage } = useChat();

  const handleSubmit = async (text: string, files: FileList) => {
    const fileParts = await convertFileListToFileUIParts(files);

    await sendMessage({
      text,
      parts: [
        { type: 'text', text },
        ...fileParts,
      ],
    });
  };

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.parts.map((part, i) => {
            if (isTextUIPart(part)) return <p key={i}>{part.text}</p>;
            if (isFileUIPart(part)) return <img key={i} src={part.url} />;
            if (isReasoningUIPart(part)) {
              return <details key={i}><summary>思考过程</summary>{part.text}</details>;
            }
          })}
        </div>
      ))}
    </div>
  );
};
```

### 3. 带修剪的长对话优化

```typescript
const OptimizedChat = () => {
  const { messages, sendMessage } = useChat();

  const handleSend = async (text: string) => {
    // 修剪历史消息
    const prunedMessages = pruneMessages({
      messages: convertToModelMessages(messages),
      reasoning: 'none',  // 移除推理节省 token
      toolCalls: 'before-last-5-messages',
      emptyMessages: 'remove',
    });

    await sendMessage(text, {
      body: { messages: prunedMessages }
    });
  };

  return <ChatInterface onSend={handleSend} />;
};
```

---

## 总结：常用功能速查表

| 功能 | 用途 | 典型场景 |
|------|------|---------|
| `pruneMessages` | 修剪历史消息 | 长对话优化、节省 token |
| `smoothStream` | 平滑流式输出 | 提升用户体验、中文逐字输出 |
| `output.object()` | 结构化输出 | 替代 generateObject，类型安全 |
| `extractReasoningMiddleware` | 提取推理过程 | 显示 AI"思考"、调试 |
| `isToolUIPart` | 类型守卫 | 安全处理消息部分 |
| `convertFileListToFileUIParts` | 文件上传 | 多模态对话 |
| `embed` / `embedMany` | 嵌入向量 | RAG、语义搜索 |
| `rerank` | 重排序 | 优化搜索结果 |
| `stepCountIs` | 限制步骤 | 防止 Agent 无限循环 |
| `addToolInputExamplesMiddleware` | 工具示例 | 提升工具调用准确性 |

---

## 参考资料

- 类型定义: `node_modules/ai/dist/index.d.ts`
- AI SDK 官方文档: https://sdk.vercel.ai/docs
- 相关文档: `ai-sdk-v6-guide.md`

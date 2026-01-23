# NexusNote AI 架构设计

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面                              │
├─────────────────────────────────────────────────────────────┤
│  Chat Sidebar  │  Agent Panel  │  Editor  │  Learning       │
└────────┬────────────────┬───────────┬──────────────┬─────────┘
         │                │           │              │
         ▼                ▼           ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    前端 API Routes                           │
│  /api/chat    /api/completion   /api/flashcard/generate     │
│  /api/learn/generate   /api/learn/generate-content          │
└────────┬────────────────┬───────────┬──────────────┬─────────┘
         │                │           │              │
         ▼                ▼           ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI 模型层 (lib/ai.ts)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  chatModel   │  │  fastModel   │  │embeddingModel│      │
│  │ (DeepSeek)   │  │ (DeepSeek)   │  │  (Qwen3)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌──────────────────────┐              ┌──────────────────────┐
│   前端 Agent 系统     │              │   后端 RAG 服务      │
│  (lib/agents/)       │              │  (server/rag/)       │
│  - 规划和推理        │              │  - 文档向量化        │
│  - 工具调用          │              │  - 语义搜索          │
│  - 多步执行          │              │  - Reranker          │
└──────────────────────┘              └──────────────────────┘
```

## 模型分工

### 1. Chat Model (DeepSeek-Chat)

**用途：** 主要的对话和推理模型

**使用场景：**
- ✅ **Chat Sidebar** - 用户对话
- ✅ **Agent 系统** - 规划、推理、反思
- ✅ **Completion** - 编辑器智能补全
- ✅ **Flashcard 生成** - 从内容生成闪卡
- ✅ **Learning 内容生成** - 生成学习材料

**特点：**
- 强推理能力
- 支持工具调用 (function calling)
- 多轮对话能力
- 上下文理解好

**配置：**
```typescript
// apps/web/lib/ai.ts
export const chatModel = primaryProvider
  ? createChatModel(primaryProvider, 'chat')
  : null
```

### 2. Fast Model (可选)

**用途：** 快速响应的轻量模型

**使用场景：**
- 简单的文本生成
- 快速摘要
- 实时补全

**特点：**
- 响应更快
- 成本更低
- 能力稍弱

**配置：**
```typescript
export const fastModel = primaryProvider
  ? createChatModel(primaryProvider, 'fast')
  : null
```

### 3. Embedding Model (Qwen3-Embedding-8B)

**用途：** 文本向量化

**使用场景：**
- ✅ **后端 RAG 服务** - 文档向量化
- ✅ **语义搜索** - 查询向量化
- ✅ **相似度计算** - 找相关内容

**特点：**
- 专门的向量模型
- 4000 维向量
- MTEB 排名第一

**配置：**
```typescript
// apps/server/src/rag/rag.service.ts
const embeddingModel = openai.embedding(env.EMBEDDING_MODEL)
```

### 4. Web Search Model (可选)

**用途：** 联网搜索增强

**使用场景：**
- ✅ **Learning 生成** - 获取最新知识
- 需要实时信息的场景

**特点：**
- 302.ai 专属
- 自动联网搜索
- 模型名加 `-web-search` 后缀

**配置：**
```typescript
export const webSearchModel = provider
  ? createWebSearchModel(provider, 'chat')
  : null
```

## 前后端协作

### 前端 (apps/web)

**职责：**
1. **用户交互** - Chat、Agent、Editor
2. **流式响应** - 实时显示 AI 输出
3. **Agent 执行** - 本地规划和工具调用
4. **UI 渲染** - 展示结果

**使用的模型：**
- `chatModel` - 所有对话和生成任务
- `webSearchModel` - 需要联网时

**代码位置：**
```
apps/web/
├── lib/ai.ts              # 模型配置
├── lib/agents/            # Agent 系统
├── app/api/chat/          # Chat API
├── app/api/completion/    # Completion API
└── app/api/flashcard/     # Flashcard API
```

### 后端 (apps/server)

**职责：**
1. **RAG 服务** - 向量搜索
2. **文档处理** - 分块、向量化
3. **数据持久化** - 存储到 PostgreSQL
4. **Reranker** - 二次排序

**使用的模型：**
- `embeddingModel` - 文本向量化
- `rerankerModel` - 结果重排序（可选）

**代码位置：**
```
apps/server/
└── src/rag/
    ├── rag.service.ts     # RAG 核心逻辑
    └── rag.controller.ts  # API 端点
```

## 数据流示例

### 场景 1: 用户对话 + RAG

```
1. 用户输入问题
   ↓
2. 前端 /api/chat
   ├─→ 调用后端 /rag/search (使用 embeddingModel)
   │   └─→ 返回相关文档片段
   └─→ 使用 chatModel 生成回答
       └─→ 流式返回给用户
```

### 场景 2: Agent 执行任务

```
1. 用户输入目标
   ↓
2. Agent.plan() - 使用 chatModel 制定计划
   ↓
3. Agent.execute() - 逐步执行
   ├─→ 调用工具 (searchNotes)
   │   └─→ 后端 RAG (embeddingModel)
   ├─→ 调用工具 (createFlashcards)
   │   └─→ chatModel 生成闪卡
   └─→ Agent.reflect() - chatModel 反思
       ↓
4. Agent.synthesize() - chatModel 总结结果
```

### 场景 3: 学习内容生成

```
1. 用户输入主题
   ↓
2. /api/learn/generate
   ├─→ 使用 webSearchModel (如果可用)
   │   └─→ 联网获取最新知识
   └─→ 或使用 chatModel
       └─→ 生成学习大纲
           ↓
3. /api/learn/generate-content
   └─→ 使用 chatModel 生成章节内容
```

## 最佳实践

### 1. 模型选择原则

| 任务类型 | 推荐模型 | 原因 |
|---------|---------|------|
| **复杂推理** | chatModel | 需要深度思考 |
| **快速响应** | fastModel | 简单任务，追求速度 |
| **向量化** | embeddingModel | 专门的向量模型 |
| **联网搜索** | webSearchModel | 需要最新信息 |

### 2. 前后端分工

**前端负责：**
- ✅ 用户交互逻辑
- ✅ 流式响应处理
- ✅ Agent 规划和执行
- ✅ 轻量级 AI 任务

**后端负责：**
- ✅ 重计算任务（向量化）
- ✅ 数据持久化
- ✅ 批量处理
- ✅ 定时任务

### 3. 性能优化

**缓存策略：**
```typescript
// 缓存 Embedding 结果
const cachedEmbedding = await cache.get(text)
if (cachedEmbedding) return cachedEmbedding

const embedding = await embed({ model: embeddingModel, value: text })
await cache.set(text, embedding)
```

**并行处理：**
```typescript
// 并行向量化多个文本
const embeddings = await embedMany({
  model: embeddingModel,
  values: texts,
})
```

**流式响应：**
```typescript
// 使用 streamText 而不是 generateText
const result = streamText({
  model: chatModel,
  // ...
})
return result.toUIMessageStreamResponse()
```

### 4. 错误处理

**模型降级：**
```typescript
const model = webSearchModel ?? chatModel ?? fastModel
if (!model) {
  throw new Error('No AI model configured')
}
```

**重试机制：**
```typescript
async function embedWithRetry(text: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await embed({ model: embeddingModel, value: text })
    } catch (error) {
      if (i === retries - 1) throw error
      await sleep(1000 * (i + 1))
    }
  }
}
```

### 5. 成本控制

**Token 限制：**
```typescript
const result = await generateText({
  model: chatModel,
  maxOutputTokens: 2048,  // 限制输出长度
  // ...
})
```

**使用 Fast Model：**
```typescript
// 简单任务用 fastModel
const model = isComplexTask ? chatModel : fastModel
```

**批量处理：**
```typescript
// 一次性向量化多个文本，而不是逐个调用
const embeddings = await embedMany({ model, values: texts })
```

## 配置管理

### 环境变量

```bash
# Chat Provider
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx

# Embedding Provider
AI_302_API_KEY=sk-xxx
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
EMBEDDING_DIMENSIONS=4000

# Reranker (可选)
RERANKER_MODEL=Qwen/Qwen3-Reranker-8B
RERANKER_ENABLED=true
```

### 代码配置

```typescript
// apps/web/lib/ai.ts
const primaryProvider = getPrimaryProvider()  // 根据 AI_PROVIDER 选择
const embeddingConfig = getEmbeddingProvider()  // 优先 302.ai

export const chatModel = primaryProvider ? createChatModel(primaryProvider, 'chat') : null
export const embeddingModel = embeddingConfig ? createEmbeddingModel(embeddingConfig) : null
```

## 扩展性

### 添加新模型

1. **在 config 中定义：**
```typescript
// packages/config/src/index.ts
providers: {
  newProvider: {
    baseURL: 'https://api.example.com',
    chatModel: 'model-name',
    fastModel: 'fast-model-name',
  }
}
```

2. **在 ai.ts 中添加：**
```typescript
if (process.env.NEW_PROVIDER_API_KEY) {
  providers.push({
    name: 'newProvider',
    baseURL: config.providers.newProvider.baseURL,
    apiKey: process.env.NEW_PROVIDER_API_KEY,
    models: {
      chat: config.providers.newProvider.chatModel,
      fast: config.providers.newProvider.fastModel,
    },
  })
}
```

### 添加新功能

1. **创建 API Route：**
```typescript
// apps/web/app/api/new-feature/route.ts
import { chatModel } from '@/lib/ai'

export async function POST(req: Request) {
  const result = await generateText({
    model: chatModel,
    // ...
  })
  return Response.json(result)
}
```

2. **或添加 Agent 工具：**
```typescript
// apps/web/lib/agents/tools/new-tool.ts
export const newTool = {
  name: 'newTool',
  description: '...',
  execute: async (input, context) => {
    // 使用 chatModel 或其他模型
  }
}
```

## 总结

**核心原则：**
1. ✅ **前端用 chatModel** - 对话、Agent、生成
2. ✅ **后端用 embeddingModel** - 向量化、搜索
3. ✅ **统一配置** - 通过 lib/ai.ts 管理
4. ✅ **职责分离** - 前端交互，后端计算
5. ✅ **可扩展** - 易于添加新模型和功能

这个架构既保证了性能，又保持了灵活性和可维护性。

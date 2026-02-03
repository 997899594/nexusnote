# NexusNote AI 系统改进清单（2026 精简版）

**创建时间**: 2026-02-03 (修订)
**技术标准**: AI SDK v6 原生能力优先
**核心原则**: 利用 SDK 自带功能，避免引入不必要的工具

---

## 🎯 重新评估：AI SDK v6 能做什么？

基于官方文档研究，AI SDK v6 **原生支持**以下功能：

| 功能 | AI SDK v6 原生 | 需要外部工具 | 状态 |
|------|---------------|-------------|------|
| **自动重试** | ✅ `maxRetries` | ❌ | ✅ 已实现 |
| **监控回调** | ✅ `onFinish` | ❌ | ✅ 已实现 |
| **结构化输出** | ✅ `Output.object` | ❌ | ✅ 已实现 |
| **Prompt Caching** | ✅ 自动（OpenAI/Anthropic） | ❌ | ✅ 已验证 |
| **OpenTelemetry** | ✅ `experimental_telemetry` | ⚠️ Langfuse（推荐） | ✅ 已实现 |
| **响应缓存** | ⚠️ 需中间件 | ✅ Redis | ⏳ 待评估 (P2) |
| **自动降级** | ❌ 不支持 | ✅ 手动实现 | ⏳ 待评估 (P2) |
| **并行工具调用** | ❌ **不支持** | ❌ | ❌ 移除 |

---

## ❌ 移除的项目（过度工程）

### 1. Helicone AI Gateway

**为什么移除：**
- ✅ AI SDK 已有 `maxRetries` 自动重试
- ✅ AI SDK 有 `onFinish` 监控
- ⚠️ 缓存可以用 `wrapLanguageModel` + Redis 实现
- ⚠️ 自动降级需要手动实现（Helicone 也只是代理层）
- ⚠️ Dashboard 可以用 Langfuse 替代（官方推荐）

**结论**：Helicone 不是必需的，引入额外依赖。

### 2. maxParallelToolCalls

**为什么移除：**
- ❌ AI SDK v6 **不支持**并行工具调用
- ❌ 工具调用是**顺序执行**的
- ⚠️ 如果真需要并行，需要手动编排（复杂度高）

**结论**：SDK 不支持，不应该列在 TODO 中。

### 3. generateObject

**为什么移除：**
- ⚠️ 已在 v6 中**弃用**
- ✅ 应该用 `generateText + Output.object` 替代
- ⚠️ Anthropic 的 generateObject 有缓存问题

**结论**：使用新的 API。

---

## ✅ 保留的项目（真正有价值）

### P0-1: AI SDK v6 原生功能 ✅ 已完成

**已实现：**
- ✅ `maxRetries: 3` - 所有 AI 调用自动重试
- ✅ `onFinish` - 记录 tokens、成本、完成原因

**修改的文件（5个）：**
```
apps/web/app/api/chat/route.ts
apps/web/lib/ai/agents/interview/machine.ts
apps/web/app/api/completion/route.ts
apps/web/app/api/ghost/analyze/route.ts
apps/web/app/api/learn/generate-content/route.ts
```

**示例：**
```typescript
const result = streamText({
  model: chatModel,
  messages,
  maxRetries: 3,  // ✅ SDK 原生
  onFinish: ({ usage, finishReason }) => {
    // ✅ SDK 原生
    console.log(`Tokens: ${usage.totalTokens}, Reason: ${finishReason}`);
  },
});
```

---

### P1-1: Langfuse 可观测性（1h）✅ 已完成

**为什么 Langfuse？**
- ✅ AI SDK 官方推荐的集成
- ✅ 原生支持 `experimental_telemetry`
- ✅ 自动追踪：tokens、成本、延迟、错误
- ✅ 可视化 Dashboard
- ✅ 免费层足够用

**实施步骤：**

```bash
# 1. 安装
pnpm add langfuse

# 2. 注册 Langfuse Cloud（免费）
# https://langfuse.com/signup

# 3. 获取 API Keys
# Dashboard → Settings → API Keys
```

**代码修改：**

```typescript
// apps/web/lib/ai/langfuse.ts (新建)
import Langfuse from 'langfuse';

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: 'https://cloud.langfuse.com',
});
```

```typescript
// apps/web/app/api/chat/route.ts
import { langfuse } from '@/lib/ai/langfuse';

const result = streamText({
  model: chatModel,
  messages,
  maxRetries: 3,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'chat-agent',
    metadata: {
      userId: session.user.id,
    },
  },
});
```

**环境变量：**
```bash
# .env
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
```

**收益：**
- ✅ 自动记录所有 AI 调用（无需手写日志）
- ✅ Dashboard 可视化：tokens、成本、延迟
- ✅ 追踪工具调用链
- ✅ 成本分析和预算告警

**文件清单：**
- `apps/web/lib/ai/langfuse.ts` (新建)
- `apps/web/app/api/chat/route.ts`
- `apps/web/app/api/learn/interview/route.ts`
- `apps/web/app/api/learn/generate/route.ts`
- `.env.example`
- `packages/config/src/index.ts`

---

### P1-2: 结构化输出优化（2h）✅ 已完成

**为什么重要：**
- ✅ AI SDK v6 原生支持
- ✅ 比 JSON.parse 更可靠
- ✅ 类型安全（TypeScript 端到端）
- ✅ 某些模型对结构化输出优化（更低成本）

**当前问题：**

```typescript
// ❌ 不可靠的旧方案
const result = await generateText({
  model: courseModel,
  prompt: '生成课程大纲，返回 JSON...',
});
const outline = JSON.parse(result.text);  // 可能失败
```

**改进方案：**

```typescript
// ✅ 类型安全的新方案
import { Output } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: courseModel,
  output: Output.object({
    schema: z.object({
      title: z.string(),
      chapters: z.array(z.object({
        title: z.string(),
        summary: z.string(),
        keyPoints: z.array(z.string()),
      })),
    }),
  }),
  prompt: '生成课程大纲...',
});

// result.object 是类型安全的
const outline = result.object;  // ✅ 类型推断
```

**应用场景：**

1. **课程大纲生成** → `apps/web/app/api/learn/generate/route.ts`
2. **闪卡生成** → `apps/web/app/api/flashcard/generate/route.ts`
3. **意图路由** → `apps/web/lib/ai/router/route.ts`

**注意事项：**
- ⚠️ Anthropic 的 Prompt Caching 在使用 Output.object 时效果更好（避免 generateObject 的 schema 问题）

**文件清单：**
- `apps/web/app/api/learn/generate/route.ts`
- `apps/web/app/api/flashcard/generate/route.ts`
- `apps/web/lib/ai/router/route.ts`

---

### P1-3: Prompt Caching 验证（1h）✅ 已完成

**为什么重要：**
- ✅ 节省 **90% 成本**（System Prompt 缓存）
- ✅ 节省 **50% 延迟**（缓存命中）
- ✅ OpenAI 和 Anthropic 原生支持

**OpenAI Prompt Caching**

✅ **自动启用**（无需配置）

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  messages: [
    { role: 'system', content: LONG_SYSTEM_PROMPT },  // >= 1024 tokens 自动缓存
    { role: 'user', content: '用户问题' },
  ],
});

// 检查缓存命中
console.log({
  cachedTokens: result.usage.cacheReadInputTokens,  // 从缓存读取
  cacheCreation: result.usage.cacheCreationInputTokens,  // 首次创建
});
```

**Anthropic Prompt Caching**

⚠️ **需要避免 generateObject**

```typescript
// ❌ 不推荐：generateObject 破坏缓存
const result = await generateObject({
  model: anthropic('claude-3-5-sonnet-20241022'),
  schema: z.object({ name: z.string() }),
  prompt: '提取姓名',
});

// ✅ 推荐：generateText + Output.object
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  output: Output.object({
    schema: z.object({ name: z.string() }),
  }),
  prompt: '提取姓名',
});
```

**任务：**
1. 检查当前代码中的 System Prompt 长度（需要 >= 1024 tokens）
2. 验证 Langfuse Dashboard 中的缓存命中率
3. 避免使用 generateObject（已弃用）

**文件清单：**
- 无需修改代码（OpenAI 自动启用）
- 验证 `apps/web/lib/ai/agents/chat-agent.ts` 的 System Prompt 长度

---

### P2-1: 响应缓存（可选，2h）⏳ 待评估

**为什么可选：**
- ⚠️ Prompt Caching 已经节省了大部分成本
- ⚠️ 需要 Redis 基础设施
- ⚠️ 缓存失效策略复杂

**实施方案：**

```typescript
// apps/web/lib/ai/cache-middleware.ts (新建)
import { wrapLanguageModel } from 'ai';
import { createRedisClient } from './redis';

const redis = createRedisClient();

export function createCachedModel(model: LanguageModel) {
  return wrapLanguageModel({
    model,
    async wrapGenerate(doGenerate, params) {
      const cacheKey = `ai:${hashParams(params)}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const result = await doGenerate(params);
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
      return result;
    },
  });
}
```

**使用：**

```typescript
import { createCachedModel } from '@/lib/ai/cache-middleware';

const cachedModel = createCachedModel(chatModel);

const result = await generateText({
  model: cachedModel,
  prompt: '...',
});
```

**文件清单：**
- `apps/web/lib/ai/cache-middleware.ts` (新建)
- `apps/web/lib/redis.ts` (新建或复用现有)

---

### P2-2: 自动降级逻辑（可选，2h）⏳ 待评估

**为什么可选：**
- ⚠️ AI SDK 不支持自动降级
- ⚠️ 需要手动实现 try-catch
- ⚠️ 增加代码复杂度

**实施方案：**

```typescript
// apps/web/lib/ai/fallback.ts (新建)
import { generateText, LanguageModel } from 'ai';

export async function generateWithFallback(
  models: LanguageModel[],
  options: Parameters<typeof generateText>[0],
) {
  for (let i = 0; i < models.length; i++) {
    try {
      return await generateText({
        ...options,
        model: models[i],
        maxRetries: i === models.length - 1 ? 3 : 1,  // 最后一个模型多重试
      });
    } catch (error) {
      if (i === models.length - 1) {
        throw error;  // 所有模型都失败
      }
      console.warn(`Model ${i} failed, trying next...`, error);
    }
  }
}
```

**使用：**

```typescript
import { generateWithFallback } from '@/lib/ai/fallback';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateWithFallback(
  [
    openai('gpt-4o'),
    anthropic('claude-3-5-sonnet-20241022'),
    openai('gpt-4o-mini'),
  ],
  {
    prompt: '用户问题',
  },
);
```

**文件清单：**
- `apps/web/lib/ai/fallback.ts` (新建)

---

### P2-3: RAG Pipeline 优化（可选，5h）⏳ 待评估

**当前 RAG：**
- ✅ 向量检索（pgvector）
- ✅ Reranker（Qwen3-Reranker-8B）

**可选优化：**

1. **Query Rewriting（1h）**
   - 用 LLM 改写用户问题
   - "它怎么收费" → "NexusNote 定价策略"

2. **Hybrid Search（2h）**
   - 向量检索 + BM25 关键词检索
   - RRF (Reciprocal Rank Fusion) 合并结果

3. **Context Compression（1h）**
   - 只取 Top-5 最相关片段
   - 移除冗余内容

4. **Reranking 验证（1h）**
   - 确认 Reranker 真正在工作
   - 测量检索准确率提升

**是否需要：**
- ⚠️ 取决于当前 RAG 的效果
- ⚠️ 如果用户没有抱怨检索不准，可能不需要
- ⚠️ 增加系统复杂度和 LLM 调用成本

**文件清单：**
- `apps/server/src/rag/rag.service.ts`
- `apps/web/lib/ai/rag-pipeline.ts` (新建)

---

## 📊 优先级总结

### 立即执行（P1）
- [x] **P0-1**: AI SDK v6 原生功能（maxRetries, onFinish）✅ 已完成
- [x] **P1-1**: Langfuse 可观测性（1h）✅ 已完成
- [x] **P1-2**: 结构化输出优化（2h）✅ 已完成
- [x] **P1-3**: Prompt Caching 验证（1h）✅ 已完成

**总计**: 4h ✅ **全部完成**

### 可选执行（P2）
- [ ] **P2-1**: 响应缓存（2h）- 如果 Prompt Caching 不够
- [ ] **P2-2**: 自动降级逻辑（2h）- 如果稳定性要求高
- [ ] **P2-3**: RAG Pipeline 优化（5h）- 如果检索效果差

**总计**: 9h

---

## ✅ 关键差异：修订前 vs 修订后

| 项目 | 修订前 | 修订后 | 理由 |
|------|-------|-------|------|
| **Helicone** | ✅ P0 必需 | ❌ 移除 | AI SDK 已有 maxRetries |
| **OpenTelemetry** | ✅ P0 必需 | ⚠️ 改用 Langfuse | 官方推荐集成 |
| **generateObject** | ✅ P1 必需 | ❌ 移除 | 已弃用，用 Output.object |
| **maxParallelToolCalls** | ✅ P1 必需 | ❌ 移除 | SDK 不支持 |
| **响应缓存** | ❌ 未提及 | ⚠️ P2 可选 | wrapLanguageModel 实现 |
| **自动降级** | ✅ Helicone 提供 | ⚠️ P2 手动 | SDK 不支持 |

---

## 💡 核心原则（修订后）

1. **SDK 优先** - 优先使用 AI SDK v6 原生功能
2. **官方推荐** - 使用官方推荐的集成（Langfuse）
3. **避免过度工程** - 不引入不必要的工具（Helicone）
4. **可选优化** - 复杂优化标记为可选（缓存、降级、RAG）

---

**维护者**: NexusNote AI Team
**技术标准**: AI SDK v6 原生能力
**最后更新**: 2026-02-03 (修订版)

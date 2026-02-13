/**
 * AI Provider Registry — 多 Provider Fallback + 熔断器
 *
 * 设计：
 * 1. 启动时检测所有配置了 API Key 的 provider
 * 2. 每个 provider 配一个 CircuitBreaker（连续失败 3 次后熔断 60 秒）
 * 3. 每个 model 角色（chat/course/agent/...）创建 fallback chain
 * 4. 调用时按优先级尝试，跳过已熔断的 provider，失败自动切换
 * 5. 中间件（reasoning extraction 等）包装在 fallback model 外层
 */

import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { clientEnv, env } from "@nexusnote/config";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  addToolInputExamplesMiddleware,
  type EmbeddingModel,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { CircuitBreaker } from "./circuit-breaker";
import { createFallbackModel, type FallbackCandidate } from "./fallback-model";

// ============================================
// Provider 配置
// ============================================

interface ProviderDefinition {
  name: string;
  baseURL: string;
  envKey: () => string;
  priority: number; // 数字越小越优先
  models: {
    chat: string;
    pro: string;
    webSearch: string | null;
    embedding: string | null;
  };
}

/**
 * 所有支持的 Provider 定义
 * 按优先级排列：302.ai > DeepSeek > OpenAI
 */
const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    name: "302.ai",
    baseURL: "https://api.302.ai/v1",
    envKey: () =>
      (typeof window === "undefined" ? env.AI_302_API_KEY : undefined) ||
      clientEnv.AI_302_API_KEY ||
      "",
    priority: 0,
    models: {
      chat: "gemini-3-flash-preview",
      pro: "gemini-3-pro-preview",
      webSearch: "gemini-3-flash-preview-web-search",
      embedding: "Qwen/Qwen3-Embedding-8B",
    },
  },
  {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    envKey: () =>
      (typeof window === "undefined" ? env.DEEPSEEK_API_KEY : undefined) ||
      clientEnv.DEEPSEEK_API_KEY ||
      "",
    priority: 1,
    models: {
      chat: "deepseek-chat",
      pro: "deepseek-chat",
      webSearch: null,
      embedding: null,
    },
  },
  {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    envKey: () =>
      (typeof window === "undefined" ? env.OPENAI_API_KEY : undefined) ||
      clientEnv.OPENAI_API_KEY ||
      "",
    priority: 2,
    models: {
      chat: "gpt-4o-mini",
      pro: "gpt-4o",
      webSearch: null,
      embedding: null,
    },
  },
];

// ============================================
// 已初始化的 Provider 实例
// ============================================

interface InitializedProvider {
  definition: ProviderDefinition;
  client: OpenAIProvider;
  breaker: CircuitBreaker;
}

// ============================================
// Registry
// ============================================

export interface AIRegistry {
  chatModel: LanguageModelV3 | null;
  courseModel: LanguageModelV3 | null;
  agentModel: LanguageModelV3 | null;
  webSearchModel: LanguageModelV3 | null;
  fastModel: LanguageModelV3 | null;
  embeddingModel: EmbeddingModel | null;

  providers: InitializedProvider[];
}

/**
 * 初始化所有可用 Provider，构建 Fallback Chain
 */
function initializeRegistry(): AIRegistry {
  // 1. 检测所有有 API Key 的 provider，按优先级排序
  const providers: InitializedProvider[] = PROVIDER_DEFINITIONS
    .filter((def) => {
      const key = def.envKey();
      return key && key.length > 0;
    })
    .sort((a, b) => a.priority - b.priority)
    .map((def) => ({
      definition: def,
      client: createOpenAI({
        baseURL: def.baseURL,
        apiKey: def.envKey(),
      }),
      breaker: new CircuitBreaker(def.name, {
        failureThreshold: 3,
        resetTimeoutMs: 60_000,
      }),
    }));

  if (typeof window === "undefined") {
    console.log(`[AI Registry] ${providers.length} 个 provider 可用:`);
    for (const p of providers) {
      const masked = p.definition.envKey().slice(0, 8) + "...";
      console.log(`  - ${p.definition.name} (优先级 ${p.definition.priority}, key=${masked})`);
    }
  }

  if (providers.length === 0) {
    console.warn("[AI Registry] 没有配置任何 API Key");
    return {
      chatModel: null,
      courseModel: null,
      agentModel: null,
      webSearchModel: null,
      fastModel: null,
      embeddingModel: null,
      providers: [],
    };
  }

  // 2. 为每个 model 角色构建 fallback chain
  const chatFallback = buildFallbackChain(providers, "chat");
  const proFallback = buildFallbackChain(providers, "pro");

  // 3. 应用中间件（包装在 fallback model 外层，只需定义一次）
  const chatModel = chatFallback
    ? withStandardMiddleware(chatFallback)
    : null;

  const courseModel = proFallback
    ? withReasoningMiddleware(proFallback)
    : null;

  // 4. Web Search — 只有部分 provider 支持，不做 fallback（降级为无搜索）
  const webSearchProvider = providers.find(
    (p) => p.definition.models.webSearch !== null,
  );
  const webSearchModel = webSearchProvider
    ? webSearchProvider.client.chat(webSearchProvider.definition.models.webSearch!)
    : null;

  // 5. Embedding — 只有部分 provider 支持
  const embeddingProvider = providers.find(
    (p) => p.definition.models.embedding !== null,
  );
  const embeddingModel = embeddingProvider
    ? embeddingProvider.client.embedding(
        clientEnv.EMBEDDING_MODEL || embeddingProvider.definition.models.embedding!,
      )
    : null;

  return {
    chatModel,
    courseModel,
    agentModel: chatModel, // agent 复用 chat model
    webSearchModel,
    fastModel: chatModel, // fast 复用 chat model（已经是 flash 级别）
    embeddingModel,
    providers,
  };
}

// ============================================
// 内部工具函数
// ============================================

/**
 * 为指定 model 角色构建 fallback candidate 列表
 */
function buildFallbackChain(
  providers: InitializedProvider[],
  role: "chat" | "pro",
): LanguageModelV3 | null {
  const candidates: FallbackCandidate[] = providers.map((p) => ({
    model: p.client.chat(p.definition.models[role]),
    breaker: p.breaker,
  }));

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].model as LanguageModelV3;

  return createFallbackModel(candidates) as LanguageModelV3;
}

/**
 * 标准中间件：reasoning extraction + tool input examples
 */
function withStandardMiddleware(model: LanguageModelV3): LanguageModelV3 {
  return wrapLanguageModel({
    model,
    middleware: [
      extractReasoningMiddleware({
        tagName: "thinking",
        separator: "\n\n---\n\n",
        startWithReasoning: false,
      }),
      addToolInputExamplesMiddleware({
        prefix: "示例调用：",
      }),
    ],
  });
}

/**
 * Pro 模型中间件：只加 reasoning extraction
 */
function withReasoningMiddleware(model: LanguageModelV3): LanguageModelV3 {
  return wrapLanguageModel({
    model,
    middleware: [
      extractReasoningMiddleware({
        tagName: "thinking",
        separator: "\n\n---\n\n",
        startWithReasoning: false,
      }),
    ],
  });
}

// ============================================
// 全局实例 + 导出
// ============================================

export const registry = initializeRegistry();

export function isAIConfigured(): boolean {
  return registry.providers.length > 0;
}

export function isEmbeddingConfigured(): boolean {
  return registry.embeddingModel !== null;
}

export function isWebSearchAvailable(): boolean {
  return registry.webSearchModel !== null;
}

export function getAIProviderInfo() {
  return {
    providers: registry.providers.map((p) => ({
      name: p.definition.name,
      priority: p.definition.priority,
      circuitBreaker: p.breaker.getStatus(),
    })),
    models: {
      chat: registry.chatModel ? "Ready" : "N/A",
      course: registry.courseModel ? "Ready" : "N/A",
      webSearch: registry.webSearchModel ? "Ready" : "N/A",
      embedding: registry.embeddingModel ? "Ready" : "N/A",
    },
    embeddingDimensions: clientEnv.EMBEDDING_DIMENSIONS,
    configured: registry.providers.length > 0,
  };
}

export function getEmbeddingConfig() {
  return {
    model: clientEnv.EMBEDDING_MODEL || "Qwen/Qwen3-Embedding-8B",
    dimensions: clientEnv.EMBEDDING_DIMENSIONS,
  };
}

// ============================================
// 启动日志
// ============================================

if (typeof window === "undefined" && registry.providers.length > 0) {
  const fallbackChain = registry.providers
    .map((p) => p.definition.name)
    .join(" → ");
  console.log(`[AI Registry] Fallback chain: ${fallbackChain}`);
  console.log(`  - Chat: ${registry.chatModel ? "Ready" : "N/A"}`);
  console.log(`  - Course: ${registry.courseModel ? "Ready" : "N/A"}`);
  console.log(`  - Web Search: ${registry.webSearchModel ? "Ready" : "N/A"}`);
  console.log(`  - Embedding: ${registry.embeddingModel ? "Ready" : "N/A"}`);
}

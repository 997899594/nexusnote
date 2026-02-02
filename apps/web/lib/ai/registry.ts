/**
 * AI Provider Registry (2026 Modern Stack)
 *
 * 统一的模型和提供商管理系统
 * 支持多提供商（302.ai, DeepSeek, OpenAI）的无缝切换
 *
 * 使用 Vercel AI SDK v6 的原生 Provider API
 * @see https://ai-sdk.dev/docs/providers
 */

import { createOpenAI } from "@ai-sdk/openai";
import { clientEnv, env, defaults } from "@nexusnote/config";
import { LanguageModel, EmbeddingModel } from "ai";

// ============================================
// 类型定义
// ============================================

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  priority: number; // 优先级：数字越小越优先
}

export interface ModelDefinition {
  id: string;
  provider: string;
  displayName: string;
  tier: "fast" | "balanced" | "power"; // 快速 | 均衡 | 强大
  capabilities: string[]; // 工具调用、web搜索等
  costRatio: number; // 相对 GPT-4 的成本比例
}

export interface AIRegistry {
  // 聊天模型
  chatModel: LanguageModel | null;
  courseModel: LanguageModel | null;
  agentModel: LanguageModel | null;
  webSearchModel: LanguageModel | null;
  fastModel: LanguageModel | null;

  // Embedding 模型
  embeddingModel: EmbeddingModel | null;

  // 元数据
  provider: ProviderConfig | null;
  models: Record<string, ModelDefinition>;
}

// ============================================
// 提供商列表
// ============================================

const PROVIDERS: Record<string, Omit<ProviderConfig, "priority">> = {
  "302ai": {
    name: "302.ai",
    baseURL: "https://api.302.ai/v1",
    apiKey:
      (typeof window === "undefined" ? env.AI_302_API_KEY : undefined) ||
      clientEnv.AI_302_API_KEY ||
      "",
  },
  deepseek: {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    apiKey:
      (typeof window === "undefined" ? env.DEEPSEEK_API_KEY : undefined) ||
      clientEnv.DEEPSEEK_API_KEY ||
      "",
  },
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKey:
      (typeof window === "undefined" ? env.OPENAI_API_KEY : undefined) ||
      clientEnv.OPENAI_API_KEY ||
      "",
  },
};

// ============================================
// 模型定义库
// ============================================

const MODEL_DEFINITIONS: Record<string, ModelDefinition> = {
  // Gemini 3 系列 (302.ai)
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    provider: "302ai",
    displayName: "Gemini 3 Flash",
    tier: "fast",
    capabilities: ["tools", "streaming", "reasoning"],
    costRatio: 0.1,
  },
  "gemini-3-pro-preview": {
    id: "gemini-3-pro-preview",
    provider: "302ai",
    displayName: "Gemini 3 Pro",
    tier: "power",
    capabilities: ["tools", "streaming", "reasoning", "long-context"],
    costRatio: 0.5,
  },
  "gemini-3-flash-preview-web-search": {
    id: "gemini-3-flash-preview-web-search",
    provider: "302ai",
    displayName: "Gemini 3 Flash (Web Search)",
    tier: "fast",
    capabilities: ["tools", "streaming", "web-search"],
    costRatio: 0.15,
  },

  // DeepSeek 模型
  "deepseek-chat": {
    id: "deepseek-chat",
    provider: "deepseek",
    displayName: "DeepSeek Chat",
    tier: "balanced",
    capabilities: ["tools", "streaming", "reasoning"],
    costRatio: 0.05,
  },

  // OpenAI 模型
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    tier: "power",
    capabilities: ["tools", "streaming", "reasoning", "vision"],
    costRatio: 1.0,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o Mini",
    tier: "fast",
    capabilities: ["tools", "streaming", "reasoning"],
    costRatio: 0.15,
  },

  // Embedding 模型
  "Qwen/Qwen3-Embedding-8B": {
    id: "Qwen/Qwen3-Embedding-8B",
    provider: "302ai",
    displayName: "Qwen 3 Embedding",
    tier: "balanced",
    capabilities: ["embedding"],
    costRatio: 0.01,
  },
};

// ============================================
// Registry 初始化
// ============================================

/**
 * 自动检测并初始化 Registry
 */
export function initializeRegistry(): AIRegistry {
  // Debug: 打印所有配置（在服务端）
  if (typeof window === "undefined") {
    console.log("[AI Registry] Checking configuration...");
    Object.entries(PROVIDERS).forEach(([key, config]) => {
      const maskedKey = config.apiKey
        ? `${config.apiKey.slice(0, 8)}...`
        : "missing";
      console.log(
        `[AI Registry] Provider ${key}: apiKey=${maskedKey}, baseURL=${config.baseURL}`,
      );
    });
  }

  // 1. 检测可用的提供商（按优先级）
  const providersWithKeys = Object.entries(PROVIDERS)
    .map(([key, config]) => ({
      key,
      ...config,
      priority: key === "302ai" ? 0 : key === "deepseek" ? 1 : 2,
    }))
    .filter((p) => p.apiKey)
    .sort((a, b) => a.priority - b.priority);

  if (providersWithKeys.length === 0) {
    console.warn("[AI Registry] No API keys configured");
    return {
      chatModel: null,
      courseModel: null,
      agentModel: null,
      webSearchModel: null,
      fastModel: null,
      embeddingModel: null,
      provider: null,
      models: MODEL_DEFINITIONS,
    };
  }

  // 2. 选择优先级最高的提供商
  const selectedProvider = providersWithKeys[0] as ProviderConfig;

  // 3. 创建 OpenAI 兼容实例
  const openai = createOpenAI({
    baseURL: selectedProvider.baseURL,
    apiKey: selectedProvider.apiKey,
  });

  // 4. 获取模型名称配置
  const chatModelId =
    clientEnv.AI_MODEL || getChatModelForProvider(selectedProvider.name);
  const proModelId =
    clientEnv.AI_MODEL_PRO || getProModelForProvider(selectedProvider.name);
  const webSearchModelId =
    clientEnv.AI_MODEL_WEB_SEARCH ||
    getWebSearchModelForProvider(selectedProvider.name);
  const embeddingModelId =
    clientEnv.EMBEDDING_MODEL || "Qwen/Qwen3-Embedding-8B";

  return {
    chatModel: openai.chat(chatModelId),
    courseModel: openai.chat(proModelId),
    agentModel: openai.chat(chatModelId), // Agent 使用 chat 模型的工具能力
    webSearchModel: webSearchModelId ? openai.chat(webSearchModelId) : null,
    fastModel: openai.chat(chatModelId),
    embeddingModel: openai.embedding(embeddingModelId),
    provider: selectedProvider,
    models: MODEL_DEFINITIONS,
  };
}

// ============================================
// 提供商特定的模型选择
// ============================================

function getChatModelForProvider(provider: string): string {
  const defaults: Record<string, string> = {
    "302.ai": "gemini-3-flash-preview",
    DeepSeek: "deepseek-chat",
    OpenAI: "gpt-4o-mini",
  };
  return defaults[provider] || "gpt-4o-mini";
}

function getProModelForProvider(provider: string): string {
  const defaults: Record<string, string> = {
    "302.ai": "gemini-3-pro-preview",
    DeepSeek: "deepseek-chat",
    OpenAI: "gpt-4o",
  };
  return defaults[provider] || "gpt-4o";
}

function getWebSearchModelForProvider(provider: string): string | null {
  const defaults: Record<string, string | null> = {
    "302.ai": "gemini-3-flash-preview-web-search",
    DeepSeek: null,
    OpenAI: null,
  };
  return defaults[provider] ?? null;
}

// ============================================
// 全局 Registry 实例
// ============================================

export const registry = initializeRegistry();

// ============================================
// 导出便利函数（向后兼容）
// ============================================

export const chatModel = registry.chatModel;
export const courseModel = registry.courseModel;
export const agentModel = registry.agentModel;
export const webSearchModel = registry.webSearchModel;
export const fastModel = registry.fastModel;
export const embeddingModel = registry.embeddingModel;

export function isAIConfigured(): boolean {
  return registry.provider !== null;
}

export function isEmbeddingConfigured(): boolean {
  return registry.embeddingModel !== null;
}

export function isWebSearchAvailable(): boolean {
  return registry.webSearchModel !== null;
}

export function getAIProviderInfo() {
  const chatDef =
    registry.models["gemini-3-flash-preview"] ||
    Object.values(registry.models)[0];
  return {
    provider: registry.provider?.name ?? "none",
    models: {
      chat: chatDef?.displayName || "unknown",
      pro: "Pro",
      webSearch: registry.webSearchModel ? "Available" : "Unavailable",
      embedding:
        registry.models["Qwen/Qwen3-Embedding-8B"]?.displayName || "unknown",
    },
    embeddingDimensions: clientEnv.EMBEDDING_DIMENSIONS,
    configured: !!registry.provider,
  };
}

export function getEmbeddingConfig() {
  return {
    model: clientEnv.EMBEDDING_MODEL || "Qwen/Qwen3-Embedding-8B",
    dimensions: clientEnv.EMBEDDING_DIMENSIONS,
  };
}

// ============================================
// 日志（启动时打印）
// ============================================

if (typeof window === "undefined" && registry.provider) {
  console.log("[AI Registry] Provider:", registry.provider.name);
  console.log("[AI Registry] Models configured:");
  console.log("  - Chat:", chatModel ? "Ready" : "N/A");
  console.log("  - Course:", courseModel ? "Ready" : "N/A");
  console.log("  - Web Search:", webSearchModel ? "Ready" : "N/A");
  console.log("  - Embedding:", embeddingModel ? "Ready" : "N/A");
}

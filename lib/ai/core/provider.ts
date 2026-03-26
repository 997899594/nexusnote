/**
 * AI Core - AI Provider Registry
 *
 * Primary provider plus fallback providers for language-model calls.
 * Embedding calls currently use the primary configured embedding provider only.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type {
  EmbeddingModelV3,
  LanguageModelV3,
  LanguageModelV3Middleware,
} from "@ai-sdk/provider";
import { extractJsonMiddleware, extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { env } from "@/config/env";

export type ModelType = "chat" | "pro" | "webSearch" | "embedding";
type LanguageModelType = Exclude<ModelType, "embedding">;
type ProviderId = "302" | "openai" | "deepseek";

interface ProviderModelConfig {
  id: ProviderId;
  label: string;
  client: ReturnType<typeof createOpenAI>;
  models: Partial<Record<ModelType, string>>;
}

const PROVIDER_PRIORITY: ProviderId[] = ["302", "openai", "deepseek"];

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

function isRetryableModelError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return [
    "timeout",
    "timed out",
    "429",
    "rate limit",
    "temporarily unavailable",
    "service unavailable",
    "503",
    "502",
    "504",
    "connection",
    "network",
    "fetch failed",
    "econnreset",
  ].some((token) => message.includes(token));
}

function createFailoverMiddleware(
  modelType: LanguageModelType,
  fallbackChain: ProviderModelConfig[],
): LanguageModelV3Middleware | undefined {
  if (fallbackChain.length === 0) {
    return undefined;
  }

  const doGenerateOnProvider = async (
    provider: ProviderModelConfig,
    params: Parameters<LanguageModelV3["doGenerate"]>[0],
  ) => {
    const modelId = provider.models[modelType];
    if (!modelId) {
      throw new Error(`Provider ${provider.label} does not support model type ${modelType}`);
    }

    return provider.client.chat(modelId).doGenerate(params);
  };

  const doStreamOnProvider = async (
    provider: ProviderModelConfig,
    params: Parameters<LanguageModelV3["doStream"]>[0],
  ) => {
    const modelId = provider.models[modelType];
    if (!modelId) {
      throw new Error(`Provider ${provider.label} does not support model type ${modelType}`);
    }

    return provider.client.chat(modelId).doStream(params);
  };

  return {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (error) {
        if (!isRetryableModelError(error)) {
          throw error;
        }

        console.warn(`[AI] Primary ${modelType} model failed, trying fallback providers:`, error);
        let lastError = error;

        for (const provider of fallbackChain) {
          try {
            return await doGenerateOnProvider(provider, params);
          } catch (fallbackError) {
            lastError = fallbackError;
            console.warn(`[AI] Fallback provider ${provider.label} failed:`, fallbackError);
          }
        }

        throw lastError;
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream();
      } catch (error) {
        if (!isRetryableModelError(error)) {
          throw error;
        }

        console.warn(`[AI] Primary ${modelType} stream failed, trying fallback providers:`, error);
        let lastError = error;

        for (const provider of fallbackChain) {
          try {
            return await doStreamOnProvider(provider, params);
          } catch (fallbackError) {
            lastError = fallbackError;
            console.warn(
              `[AI] Fallback streaming provider ${provider.label} failed:`,
              fallbackError,
            );
          }
        }

        throw lastError;
      }
    },
  };
}

function createReasoningModel(
  provider: ProviderModelConfig,
  modelType: LanguageModelType,
  fallbackChain: ProviderModelConfig[],
) {
  const modelId = provider.models[modelType];
  if (!modelId) {
    throw new Error(`Provider ${provider.label} does not support model type ${modelType}`);
  }

  const middleware = [
    extractReasoningMiddleware({
      tagName: "thinking",
      separator: "\n\n---\n\n",
    }),
    createFailoverMiddleware(modelType, fallbackChain),
  ].filter((item): item is LanguageModelV3Middleware => Boolean(item));

  return wrapLanguageModel({
    model: provider.client.chat(modelId),
    middleware,
  });
}

function createPlainModel(
  provider: ProviderModelConfig,
  modelType: LanguageModelType,
  fallbackChain: ProviderModelConfig[],
) {
  const modelId = provider.models[modelType];
  if (!modelId) {
    throw new Error(`Provider ${provider.label} does not support model type ${modelType}`);
  }

  const middleware = [createFailoverMiddleware(modelType, fallbackChain)].filter(
    (item): item is LanguageModelV3Middleware => Boolean(item),
  );

  if (middleware.length === 0) {
    return provider.client.chat(modelId);
  }

  return wrapLanguageModel({
    model: provider.client.chat(modelId),
    middleware,
  });
}

function createJsonModel(
  provider: ProviderModelConfig,
  modelType: LanguageModelType,
  fallbackChain: ProviderModelConfig[],
) {
  const modelId = provider.models[modelType];
  if (!modelId) {
    throw new Error(`Provider ${provider.label} does not support model type ${modelType}`);
  }

  const middleware = [
    extractJsonMiddleware(),
    createFailoverMiddleware(modelType, fallbackChain),
  ].filter((item): item is LanguageModelV3Middleware => Boolean(item));

  return wrapLanguageModel({
    model: provider.client.chat(modelId),
    middleware,
  });
}

class AIProvider {
  private static instance: AIProvider;
  private providers: ProviderModelConfig[] = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  private initialize(): void {
    const providers: ProviderModelConfig[] = [];

    if (env.AI_302_API_KEY) {
      providers.push({
        id: "302",
        label: "302.ai",
        client: createOpenAI({
          baseURL: env.AI_302_BASE_URL,
          apiKey: env.AI_302_API_KEY,
        }),
        models: {
          chat: env.AI_MODEL,
          pro: env.AI_MODEL_PRO,
          webSearch: env.AI_MODEL_WEB_SEARCH,
          embedding: env.EMBEDDING_MODEL,
        },
      });
    }

    if (env.OPENAI_API_KEY) {
      providers.push({
        id: "openai",
        label: "OpenAI",
        client: createOpenAI({
          apiKey: env.OPENAI_API_KEY,
          ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
        }),
        models: {
          chat: env.AI_FALLBACK_MODEL,
          pro: env.AI_FALLBACK_MODEL_PRO,
          webSearch: env.AI_FALLBACK_MODEL_WEB_SEARCH,
          embedding: "text-embedding-3-small",
        },
      });
    }

    if (env.DEEPSEEK_API_KEY) {
      providers.push({
        id: "deepseek",
        label: "DeepSeek",
        client: createOpenAI({
          baseURL: DEEPSEEK_BASE_URL,
          apiKey: env.DEEPSEEK_API_KEY,
        }),
        models: {
          chat: "deepseek-chat",
          pro: "deepseek-reasoner",
          webSearch: "deepseek-chat",
        },
      });
    }

    this.providers = PROVIDER_PRIORITY.flatMap((providerId) =>
      providers.filter((provider) => provider.id === providerId),
    );

    if (this.providers.length === 0) {
      console.warn("[AI] No AI providers configured");
      return;
    }

    console.log(
      `[AI] Providers initialized: ${this.providers.map((provider) => provider.label).join(", ")}`,
    );
  }

  isConfigured(): boolean {
    return this.providers.some((provider) => provider.models.chat);
  }

  getStatus() {
    return {
      primaryProvider: this.providers[0]?.label ?? null,
      providers: this.providers.map((provider) => provider.label),
      fallbackEnabled: this.providers.length > 1,
    };
  }

  private getLanguageModelChain(modelType: LanguageModelType): ProviderModelConfig[] {
    return this.providers.filter((provider) => provider.models[modelType]);
  }

  getModel(modelType: LanguageModelType = "chat") {
    const providers = this.getLanguageModelChain(modelType);
    const [primary, ...fallbackChain] = providers;

    if (!primary) {
      throw new Error(`No AI provider configured for model type: ${modelType}`);
    }

    return createReasoningModel(primary, modelType, fallbackChain);
  }

  getPlainModel(modelType: LanguageModelType = "chat") {
    const providers = this.getLanguageModelChain(modelType);
    const [primary, ...fallbackChain] = providers;

    if (!primary) {
      throw new Error(`No AI provider configured for model type: ${modelType}`);
    }

    return createPlainModel(primary, modelType, fallbackChain);
  }

  getJsonModel(modelType: LanguageModelType = "chat") {
    const providers = this.getLanguageModelChain(modelType);
    const [primary, ...fallbackChain] = providers;

    if (!primary) {
      throw new Error(`No AI provider configured for model type: ${modelType}`);
    }

    return createJsonModel(primary, modelType, fallbackChain);
  }

  getModelName(modelType: ModelType = "chat"): string {
    const provider = this.providers.find((item) => item.models[modelType]);
    const modelId = provider?.models[modelType];
    if (!provider || !modelId) {
      throw new Error(`No AI provider configured for model type: ${modelType}`);
    }
    return modelId;
  }

  getProviderLabel(modelType: ModelType = "chat"): string | null {
    const provider = this.providers.find((item) => item.models[modelType]);
    return provider?.label ?? null;
  }

  get embeddingModel(): EmbeddingModelV3 {
    const provider = this.providers.find((item) => item.models.embedding);
    const modelId = provider?.models.embedding;

    if (!provider || !modelId) {
      throw new Error("No embedding model configured");
    }

    return provider.client.embedding(modelId) as EmbeddingModelV3;
  }

  get chatModel() {
    return this.getModel("chat");
  }

  get plainChatModel() {
    return this.getPlainModel("chat");
  }

  get jsonChatModel() {
    return this.getJsonModel("chat");
  }

  get proModel() {
    return this.getModel("pro");
  }

  get plainProModel() {
    return this.getPlainModel("pro");
  }

  get jsonProModel() {
    return this.getJsonModel("pro");
  }

  get webSearchModel() {
    return this.getModel("webSearch");
  }

  get plainWebSearchModel() {
    return this.getPlainModel("webSearch");
  }

  get jsonWebSearchModel() {
    return this.getJsonModel("webSearch");
  }
}

export const aiProvider = AIProvider.getInstance();

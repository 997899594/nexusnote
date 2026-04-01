/**
 * AI Core - 302.ai Provider
 *
 * Runtime is intentionally single-provider.
 * Availability issues are surfaced as explicit degradation states instead of
 * hidden fallback chains.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { extractJsonMiddleware, extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { env } from "@/config/env";

export type ModelType = "chat" | "toolCalling" | "pro" | "webSearch" | "embedding";
type LanguageModelType = Exclude<ModelType, "embedding">;

function createReasoningModel(
  client: ReturnType<typeof createOpenAI>,
  modelId: string,
  _modelType: LanguageModelType,
): LanguageModelV3 {
  return wrapLanguageModel({
    model: client.chat(modelId),
    middleware: [
      extractReasoningMiddleware({
        tagName: "thinking",
        separator: "\n\n---\n\n",
      }),
    ],
  });
}

function createPlainModel(
  client: ReturnType<typeof createOpenAI>,
  modelId: string,
): LanguageModelV3 {
  return client.chat(modelId);
}

function createJsonModel(
  client: ReturnType<typeof createOpenAI>,
  modelId: string,
): LanguageModelV3 {
  return wrapLanguageModel({
    model: client.chat(modelId),
    middleware: [extractJsonMiddleware()],
  });
}

class AIProvider {
  private static instance: AIProvider;
  private readonly label = "302.ai";
  private readonly client: ReturnType<typeof createOpenAI>;
  private readonly models: Record<ModelType, string>;

  private constructor() {
    this.client = createOpenAI({
      baseURL: env.AI_302_BASE_URL,
      apiKey: env.AI_302_API_KEY,
    });
    this.models = {
      chat: env.AI_MODEL,
      toolCalling: env.AI_MODEL,
      pro: env.AI_MODEL_PRO,
      webSearch: env.AI_MODEL_WEB_SEARCH,
      embedding: env.EMBEDDING_MODEL,
    };
    if (env.AI_DEBUG_LOGS) {
      console.log(`[AI] Provider initialized: ${this.label}`);
    }
  }

  static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  isConfigured(): boolean {
    return Boolean(env.AI_302_API_KEY);
  }

  getStatus() {
    return {
      primaryProvider: this.label,
      providers: [this.label],
    };
  }

  private getModelId(modelType: ModelType): string {
    const modelId = this.models[modelType];
    if (!modelId) {
      throw new Error(`No model configured for type: ${modelType}`);
    }
    return modelId;
  }

  getModel(modelType: LanguageModelType = "chat") {
    return createReasoningModel(this.client, this.getModelId(modelType), modelType);
  }

  getPlainModel(modelType: LanguageModelType = "chat") {
    return createPlainModel(this.client, this.getModelId(modelType));
  }

  getJsonModel(modelType: LanguageModelType = "chat") {
    return createJsonModel(this.client, this.getModelId(modelType));
  }

  getToolCallingModel(modelType: LanguageModelType = "chat") {
    const targetModelType = modelType === "chat" ? "toolCalling" : modelType;
    return createPlainModel(this.client, this.getModelId(targetModelType));
  }

  getModelName(modelType: ModelType = "chat"): string {
    return this.getModelId(modelType);
  }

  getProviderLabel(modelType: ModelType = "chat"): string | null {
    void modelType;
    return this.label;
  }

  get embeddingModel(): EmbeddingModelV3 {
    return this.client.embedding(this.getModelId("embedding")) as EmbeddingModelV3;
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

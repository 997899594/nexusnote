/**
 * AI Core - 302.ai Provider
 *
 * Runtime is intentionally single-provider.
 * Availability issues are surfaced as explicit degradation states instead of
 * hidden fallback chains.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { env } from "@/config/env";
import {
  getAIModelBundle,
  getAIModelId,
  type LanguageModelType,
  type ModelType,
} from "./model-bundles";
import type { AIRouteProfile } from "./route-profiles";

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

class AIProvider {
  private static instance: AIProvider;
  private readonly label = "302.ai";
  private readonly client: ReturnType<typeof createOpenAI>;

  private constructor() {
    this.client = createOpenAI({
      baseURL: env.AI_302_BASE_URL,
      apiKey: env.AI_302_API_KEY,
    });
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

  private getModelId(modelType: ModelType, routeProfile?: AIRouteProfile): string {
    return getAIModelId(modelType, routeProfile);
  }

  getModel(modelType: LanguageModelType = "chat", routeProfile?: AIRouteProfile) {
    return createReasoningModel(this.client, this.getModelId(modelType, routeProfile), modelType);
  }

  getPlainModel(modelType: LanguageModelType = "chat", routeProfile?: AIRouteProfile) {
    return createPlainModel(this.client, this.getModelId(modelType, routeProfile));
  }

  getToolCallingModel(modelType: LanguageModelType = "chat", routeProfile?: AIRouteProfile) {
    const targetModelType = modelType === "chat" ? "toolCalling" : modelType;
    return createPlainModel(this.client, this.getModelId(targetModelType, routeProfile));
  }

  getModelName(modelType: ModelType = "chat", routeProfile?: AIRouteProfile): string {
    return this.getModelId(modelType, routeProfile);
  }

  getProviderLabel(modelType: ModelType = "chat", routeProfile?: AIRouteProfile): string | null {
    void modelType;
    return getAIModelBundle(routeProfile).providerLabel;
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

  get proModel() {
    return this.getModel("pro");
  }

  get plainProModel() {
    return this.getPlainModel("pro");
  }

  get webSearchModel() {
    return this.getModel("webSearch");
  }

  get plainWebSearchModel() {
    return this.getPlainModel("webSearch");
  }
}

export const aiProvider = AIProvider.getInstance();

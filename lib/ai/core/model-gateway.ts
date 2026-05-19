/**
 * AI model gateway.
 *
 * Users choose model series. The upstream gateway is an implementation detail.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { env } from "@/config/env";
import { getAIModelId, type LanguageModelType, type ModelType } from "./model-bundles";
import type { AIModelSeries } from "./model-series";

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

class AIModelGateway {
  private static instance: AIModelGateway;
  private readonly client: ReturnType<typeof createOpenAI>;

  private constructor() {
    this.client = createOpenAI({
      baseURL: env.AI_302_BASE_URL,
      apiKey: env.AI_302_API_KEY,
      headers: {
        Accept: "application/json",
      },
    });
    if (env.AI_DEBUG_LOGS) {
      console.log("[AI] Model gateway initialized");
    }
  }

  static getInstance(): AIModelGateway {
    if (!AIModelGateway.instance) {
      AIModelGateway.instance = new AIModelGateway();
    }
    return AIModelGateway.instance;
  }

  isConfigured(): boolean {
    return Boolean(env.AI_302_API_KEY);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
    };
  }

  private getModelId(modelType: ModelType, modelSeries?: AIModelSeries): string {
    return getAIModelId(modelType, modelSeries);
  }

  getModel(modelType: LanguageModelType = "chat", modelSeries?: AIModelSeries) {
    return createReasoningModel(this.client, this.getModelId(modelType, modelSeries), modelType);
  }

  getPlainModel(modelType: LanguageModelType = "chat", modelSeries?: AIModelSeries) {
    return createPlainModel(this.client, this.getModelId(modelType, modelSeries));
  }

  getToolCallingModel(modelType: LanguageModelType = "chat", modelSeries?: AIModelSeries) {
    const targetModelType = modelType === "chat" ? "toolCalling" : modelType;
    return createPlainModel(this.client, this.getModelId(targetModelType, modelSeries));
  }

  getModelName(modelType: ModelType = "chat", modelSeries?: AIModelSeries): string {
    return this.getModelId(modelType, modelSeries);
  }

  getEmbeddingModel(): EmbeddingModelV3 {
    return this.client.embedding(this.getModelId("embedding")) as EmbeddingModelV3;
  }
}

export const aiModelGateway = AIModelGateway.getInstance();

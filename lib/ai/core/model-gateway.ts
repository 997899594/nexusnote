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

const NATIVE_TOOL_USE_MODE = "2";
type OpenAIProviderOptions = NonNullable<Parameters<typeof createOpenAI>[0]>;
type OpenAIProviderFetch = NonNullable<OpenAIProviderOptions["fetch"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isQwenModel(model: unknown): boolean {
  return typeof model === "string" && /qwen/iu.test(model);
}

function hasTools(body: Record<string, unknown>): boolean {
  return Array.isArray(body.tools) && body.tools.length > 0;
}

function hasNamedToolChoice(body: Record<string, unknown>): boolean {
  const toolChoice = body.tool_choice;
  return (
    isRecord(toolChoice) &&
    toolChoice.type === "function" &&
    isRecord(toolChoice.function) &&
    typeof toolChoice.function.name === "string" &&
    toolChoice.function.name.length > 0
  );
}

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> | null {
  if (typeof body !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function create302CompatibleFetch(): OpenAIProviderFetch {
  return (async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    const body = parseJsonBody(init?.body);
    if (!body || !hasTools(body)) {
      return fetch(input, init);
    }

    headers.set("tool-use-mode", NATIVE_TOOL_USE_MODE);

    const nextInit: RequestInit = {
      ...init,
      headers,
    };

    if (isQwenModel(body.model) && hasNamedToolChoice(body)) {
      // Qwen thinking mode only supports auto/none tool_choice; named tools need non-thinking mode.
      nextInit.body = JSON.stringify({
        ...body,
        enable_thinking: false,
      });
    }

    return fetch(input, nextInit);
  }) as OpenAIProviderFetch;
}

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
      fetch: create302CompatibleFetch(),
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

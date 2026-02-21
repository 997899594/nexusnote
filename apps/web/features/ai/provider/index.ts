/**
 * AI Provider - 2026 Modern Single Provider (302.ai)
 *
 * 启动时自动初始化
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

const MODELS = {
  chat: "gemini-3-flash-preview",
  pro: "gemini-3-pro-preview",
  webSearch: "gemini-3-flash-preview-web-search",
  embedding: "Qwen/Qwen3-Embedding-8B",
} as const;

type ModelType = keyof typeof MODELS;

class AIProvider {
  private client: ReturnType<typeof createOpenAI> | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.AI_302_API_KEY;
    if (!apiKey) {
      console.warn("[AI] AI_302_API_KEY not set, provider not initialized");
      return;
    }
    this.client = createOpenAI({
      baseURL: "https://api.302.ai/v1",
      apiKey,
    });
    console.log("[AI] Initialized: 302.ai");
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getModel(type: ModelType = "chat"): LanguageModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized. Set AI_302_API_KEY environment variable.");
    }

    const base = this.client.chat(MODELS[type]);
    return wrapLanguageModel({
      model: base,
      middleware: extractReasoningMiddleware({
        tagName: "thinking",
        separator: "\n\n---\n\n",
      }),
    });
  }

  get embeddingModel() {
    if (!this.client) {
      throw new Error("AI Provider not initialized");
    }
    return this.client.embedding(MODELS.embedding);
  }

  get chatModel(): LanguageModelV3 {
    return this.getModel("chat");
  }
  get proModel(): LanguageModelV3 {
    return this.getModel("pro");
  }
  get webSearchModel(): LanguageModelV3 {
    return this.getModel("webSearch");
  }
}

export const aiProvider = new AIProvider();

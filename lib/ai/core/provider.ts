/**
 * AI Core - AI Provider Singleton
 *
 * Centralized AI model access for the application:
 * - aiProvider: Singleton instance for model access
 * - Model configurations for different use cases
 */

// ============================================
// AI Provider - AI 基础设施
// ============================================

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3 } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

const MODELS = {
  chat: "gemini-3.1-flash-lite-preview",
  pro: "gemini-3.1-pro-preview",
  webSearch: "gemini-3.1-flash-preview-web-search",
  embedding: "BAAI/bge-base-zh-v1.5",
} as const;

type ModelType = keyof typeof MODELS;

class AIProvider {
  private static instance: AIProvider;
  private client: ReturnType<typeof createOpenAI> | null = null;

  private constructor() {
    this.initialize();
  }

  /** Get singleton instance */
  static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  /** Initialize the AI provider with API credentials */
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

  /** Check if the provider is properly configured */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Get a language model by type */
  getModel(type: ModelType = "chat"): LanguageModel {
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

  /** Get the embedding model with correct typing */
  get embeddingModel(): EmbeddingModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized");
    }
    return this.client.embedding(MODELS.embedding) as EmbeddingModelV3;
  }

  /** Get the chat model */
  get chatModel(): LanguageModel {
    return this.getModel("chat");
  }

  /** Get the pro model */
  get proModel(): LanguageModel {
    return this.getModel("pro");
  }

  /** Get the web search model */
  get webSearchModel(): LanguageModel {
    return this.getModel("webSearch");
  }
}

/** Exported singleton instance for use throughout the application */
export const aiProvider = AIProvider.getInstance();

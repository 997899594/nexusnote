/**
 * Infrastructure Layer - AI Provider
 *
 * Centralized external dependency management for AI services.
 * This module contains no business logic - only configuration and
 * access to external AI provider APIs.
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

/**
 * AIProvider - Singleton pattern for centralized AI access
 *
 * Provides configured models for different use cases:
 * - chat: Fast chat model for general conversations
 * - pro: Premium model for complex tasks
 * - webSearch: Model with web search capabilities
 * - embedding: Text embedding model for vector operations
 */
class AIProvider {
  private static instance: AIProvider;
  private client: ReturnType<typeof createOpenAI> | null = null;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  /**
   * Initialize the AI provider with API credentials
   */
  private initialize(): void {
    const apiKey = process.env.AI_302_API_KEY;
    if (!apiKey) {
      console.warn("[Infrastructure:AI] AI_302_API_KEY not set, provider not initialized");
      return;
    }
    this.client = createOpenAI({
      baseURL: "https://api.302.ai/v1",
      apiKey,
    });
    console.log("[Infrastructure:AI] Initialized: 302.ai");
  }

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get a language model by type
   * @param type - The model type to retrieve
   * @returns A wrapped language model with reasoning extraction middleware
   */
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

  /**
   * Get the embedding model
   */
  get embeddingModel(): EmbeddingModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized");
    }
    return this.client.embedding(MODELS.embedding);
  }

  /**
   * Get the chat model
   */
  get chatModel(): LanguageModelV3 {
    return this.getModel("chat");
  }

  /**
   * Get the pro model
   */
  get proModel(): LanguageModelV3 {
    return this.getModel("pro");
  }

  /**
   * Get the web search model
   */
  get webSearchModel(): LanguageModelV3 {
    return this.getModel("webSearch");
  }
}

/**
 * Exported singleton instance for use throughout the application
 */
export const aiProvider = AIProvider.getInstance();

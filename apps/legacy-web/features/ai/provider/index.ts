/**
 * AI Provider - 302.ai 单 Provider
 *
 * 2026 架构：简化设计，只使用 302.ai (Gemini 3)
 * 无 Fallback，需要时再添加
 */

import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { defaults, type ServerEnv } from "@nexusnote/config";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

interface ModelConfig {
  chat: string;
  pro: string;
  webSearch: string;
  embedding: string;
}

class AIProvider {
  private static instance: AIProvider;
  private client: OpenAIProvider | null = null;
  private config: ModelConfig;
  private initialized = false;

  private constructor() {
    this.config = {
      chat: defaults.ai.model,
      pro: defaults.ai.modelPro,
      webSearch: defaults.ai.modelWebSearch,
      embedding: defaults.embedding.model,
    };
  }

  static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  /**
   * 初始化 Provider
   * 懒加载，只有在首次使用时才初始化
   */
  initialize(apiKey: string): void {
    if (this.initialized) return;

    if (!apiKey) {
      throw new Error("AI_302_API_KEY is required but not provided");
    }

    this.client = createOpenAI({
      baseURL: defaults.ai.baseURL,
      apiKey,
    });

    this.initialized = true;
    console.log("[AI Provider] Initialized with 302.ai (Gemini 3)");
  }

  /**
   * 检查是否已初始化
   */
  isConfigured(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * 获取聊天模型
   */
  getChatModel(): LanguageModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized. Call initialize() first.");
    }
    return this.wrapWithMiddleware(this.client.chat(this.config.chat));
  }

  /**
   * 获取 Pro 模型 (用于复杂任务)
   */
  getProModel(): LanguageModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized. Call initialize() first.");
    }
    return this.wrapWithProMiddleware(this.client.chat(this.config.pro));
  }

  /**
   * 获取联网搜索模型
   */
  getWebSearchModel(): LanguageModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized. Call initialize() first.");
    }
    return this.client.chat(this.config.webSearch);
  }

  /**
   * 获取 Embedding 模型
   */
  getEmbeddingModel(): EmbeddingModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized. Call initialize() first.");
    }
    return this.client.embedding(this.config.embedding);
  }

  /**
   * 中间件包装 - 标准聊天
   */
  private wrapWithMiddleware(model: LanguageModelV3): LanguageModelV3 {
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

  /**
   * 中间件包装 - Pro 模型
   */
  private wrapWithProMiddleware(model: LanguageModelV3): LanguageModelV3 {
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

  /**
   * 获取当前配置信息 (不包含敏感信息)
   */
  getConfigInfo() {
    return {
      provider: "302.ai",
      baseURL: defaults.ai.baseURL,
      models: this.config,
      initialized: this.initialized,
    };
  }
}

export const aiProvider = AIProvider.getInstance();

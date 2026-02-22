/**
 * AI Tools - AI 工具函数和基础设施
 *
 * 框架无关的可复用 AI 构建块：
 * - CircuitBreaker: 三态熔断器（closed → open → half-open）
 * - PromptRegistry: 可版本化的 Prompt 模板管理
 * - safeGenerateObject: 带 schema 验证重试的结构化输出
 * - aiProvider: 统一的 AI Provider 实例
 */

// ============================================
// Circuit Breaker - 熔断器
// ============================================

/**
 * 熔断器（Circuit Breaker）
 *
 * 三态模型：
 * - closed（正常）：请求正常通过，失败时累计计数
 * - open（熔断）：跳过该 provider，直接 fallback 到下一个
 * - half-open（探测）：熔断超时后放一个请求试探，成功则恢复，失败则重新熔断
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** 连续失败多少次后触发熔断 */
  failureThreshold: number;
  /** 熔断多久后进入 half-open 探测（毫秒） */
  resetTimeoutMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  readonly name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 当前是否允许请求通过 */
  canExecute(): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }

    // half-open：允许一个探测请求
    return true;
  }

  /** 记录成功 — 重置熔断器 */
  onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  /** 记录失败 — 可能触发熔断 */
  onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      this.state = "open";
      return;
    }

    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
      console.warn(`[CircuitBreaker] ${this.name} 熔断：连续失败 ${this.failures} 次`);
    }
  }

  /** 获取当前状态（调试/监控用） */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// ============================================
// Prompt Registry - Prompt 管理
// ============================================

/**
 * Prompt Registry — 可版本化的 Prompt 管理
 *
 * 设计思路：
 * 1. 每个 prompt 有 id + version，支持版本追踪
 * 2. 模板使用 {{variable}} 占位符
 * 3. render 时自动检查必需变量
 * 4. 后续可接入 Langfuse Prompt Management 实现 A/B 测试
 */

export interface PromptTemplate {
  /** 唯一标识 */
  id: string;
  /** 版本号，用于追踪 */
  version: number;
  /** 模板内容，{{variable}} 为占位符 */
  template: string;
  /** 声明需要的变量名 */
  variables: string[];
  /** 可选描述 */
  description?: string;
}

export class PromptRegistry {
  private prompts = new Map<string, PromptTemplate>();

  /** 注册一个 prompt 模板 */
  register(prompt: PromptTemplate): void {
    this.prompts.set(prompt.id, prompt);
  }

  /**
   * 渲染 prompt：替换所有 {{variable}} 占位符
   * @throws 如果 prompt 不存在或缺少必需变量
   */
  render(id: string, vars: Record<string, string>): string {
    const prompt = this.prompts.get(id);
    if (!prompt) {
      throw new Error(`[PromptRegistry] Prompt not found: ${id}`);
    }

    const missing = prompt.variables.filter((v) => !(v in vars));
    if (missing.length > 0) {
      throw new Error(`[PromptRegistry] Prompt "${id}" missing variables: ${missing.join(", ")}`);
    }

    let result = prompt.template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }

  /** 获取 prompt 元信息（用于 Langfuse 追踪） */
  getMeta(id: string): { id: string; version: number } | null {
    const prompt = this.prompts.get(id);
    return prompt ? { id: prompt.id, version: prompt.version } : null;
  }

  /** 获取所有已注册的 prompt ID 列表 */
  list(): string[] {
    return Array.from(this.prompts.keys());
  }
}

// ============================================
// Safe Generate - 带重试的结构化输出
// ============================================

/**
 * safeGenerateObject — 带 schema 验证重试的结构化输出
 *
 * 当 LLM 返回不符合 schema 的 JSON 时：
 * 1. 捕获验证错误
 * 2. 在 prompt 中附加错误信息
 * 3. 让 LLM 修正输出
 * 4. 达到 maxRetries 后抛出最终错误
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";
import { generateObject } from "ai";
import type { ZodSchema } from "zod";

export interface SafeGenerateOptions<T> {
  /** Zod schema 定义期望的输出结构 */
  schema: ZodSchema<T>;
  /** schema 验证失败后的重试次数（区别于网络重试） */
  maxRetries?: number;
  /** 使用的语言模型 */
  model: LanguageModelV3;
  /** 系统提示 */
  system: string;
  /** 用户提示 */
  prompt: string;
  /** 生成温度 */
  temperature?: number;
}

export async function safeGenerateObject<T>(options: SafeGenerateOptions<T>): Promise<T> {
  const { schema, maxRetries = 2, ...generateOptions } = options;
  let currentPrompt = generateOptions.prompt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await generateObject({
        ...generateOptions,
        prompt: currentPrompt,
        schema,
      });
      return result.object;
    } catch (error) {
      if (attempt === maxRetries) throw error;

      if (error instanceof Error) {
        console.warn(`[safeGenerateObject] 第 ${attempt + 1} 次尝试失败: ${error.message}`);
        currentPrompt = `${generateOptions.prompt}\n\n[系统提示: 上次输出格式错误: ${error.message}. 请严格遵循 JSON schema 输出。]`;
      }
    }
  }

  throw new Error("[safeGenerateObject] 所有重试均失败");
}

// ============================================
// AI Provider - AI 基础设施
// ============================================

/**
 * AIProvider - Singleton pattern for centralized AI access
 *
 * Provides configured models for different use cases:
 * - chat: Fast chat model for general conversations
 * - pro: Premium model for complex tasks
 * - webSearch: Model with web search capabilities
 * - embedding: Text embedding model for vector operations
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

const MODELS = {
  chat: "gemini-3-flash-preview",
  pro: "gemini-3-pro-preview",
  webSearch: "gemini-3-flash-preview-web-search",
  embedding: "Qwen/Qwen3-Embedding-8B",
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

  /** Get the embedding model */
  get embeddingModel(): EmbeddingModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized");
    }
    return this.client.embedding(MODELS.embedding);
  }

  /** Get the chat model */
  get chatModel(): LanguageModelV3 {
    return this.getModel("chat");
  }

  /** Get the pro model */
  get proModel(): LanguageModelV3 {
    return this.getModel("pro");
  }

  /** Get the web search model */
  get webSearchModel(): LanguageModelV3 {
    return this.getModel("webSearch");
  }
}

/** Exported singleton instance for use throughout the application */
export const aiProvider = AIProvider.getInstance();

/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * 统一的知识库检索服务，支持：
 * - 带超时的请求
 * - 自动重试
 * - 相似度过滤
 * - 结果格式化
 */

import { clientEnv, defaults } from "@nexusnote/config";

// ============================================
// Types
// ============================================

export interface RAGSearchResult {
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
}

export interface RAGSource {
  documentId: string;
  title: string;
}

export interface RAGContext {
  context: string;
  sources: RAGSource[];
  results: RAGSearchResult[];
}

export interface RAGServiceOptions {
  /** RAG API 基础 URL */
  baseUrl?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 最大重试次数 */
  retries?: number;
  /** 相似度阈值（0-1） */
  similarityThreshold?: number;
  /** 默认返回结果数量 */
  defaultTopK?: number;
}

// ============================================
// RAG Service Class
// ============================================

export class RAGService {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private similarityThreshold: number;
  private defaultTopK: number;

  constructor(options: RAGServiceOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      clientEnv.NEXT_PUBLIC_API_URL ||
      "http://localhost:3001";
    this.timeout = options.timeout || defaults.rag.timeout;
    this.retries = options.retries || defaults.rag.retries;
    this.similarityThreshold =
      options.similarityThreshold || defaults.rag.similarityThreshold;
    this.defaultTopK = options.defaultTopK || defaults.rag.topK;
  }

  /**
   * 带超时的 fetch
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 搜索知识库
   *
   * @param query 搜索查询
   * @param userId 用户 ID（用于过滤用户自己的文档）
   * @param topK 返回结果数量
   * @returns 检索上下文和来源
   */
  async search(
    query: string,
    userId: string,
    topK: number = this.defaultTopK,
  ): Promise<RAGContext> {
    const emptyResult: RAGContext = { context: "", sources: [], results: [] };

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const url = `${this.baseUrl}/rag/search?q=${encodeURIComponent(query)}&topK=${topK}&userId=${userId}`;

        const response = await this.fetchWithTimeout(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          console.error(
            `[RAG] Search failed (attempt ${attempt + 1}/${this.retries + 1}):`,
            response.status,
          );
          if (attempt < this.retries) continue;
          return emptyResult;
        }

        const results = (await response.json()) as RAGSearchResult[];

        if (results.length === 0) {
          return emptyResult;
        }

        // 过滤低相似度结果
        const relevant = results.filter(
          (r) => r.similarity > this.similarityThreshold,
        );

        if (relevant.length === 0) {
          return emptyResult;
        }

        // 格式化上下文
        const context = relevant
          .map((r, i) => `[${i + 1}] ${r.content}`)
          .join("\n\n---\n\n");

        // 去重来源
        const sources = [
          ...new Map(
            relevant.map((r) => [
              r.documentId,
              { documentId: r.documentId, title: r.documentTitle },
            ]),
          ).values(),
        ];

        return { context, sources, results: relevant };
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        console.error(
          `[RAG] ${isTimeout ? "Timeout" : "Error"} (attempt ${attempt + 1}/${this.retries + 1}):`,
          err instanceof Error ? err.message : err,
        );

        if (attempt >= this.retries) {
          return emptyResult;
        }
      }
    }

    return emptyResult;
  }

  /**
   * 搜索并返回原始结果（不格式化）
   */
  async searchRaw(
    query: string,
    userId: string,
    topK: number = this.defaultTopK,
  ): Promise<RAGSearchResult[]> {
    const { results } = await this.search(query, userId, topK);
    return results;
  }

  /**
   * 检查 RAG 服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

/** 默认 RAG 服务实例 */
export const ragService = new RAGService();

// ============================================
// Utility Functions
// ============================================

/**
 * 从消息列表中提取最后一条用户消息
 */
export function getLastUserMessage(
  messages: Array<{
    role: string;
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>,
): string {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastMessage = userMessages[userMessages.length - 1];

  if (!lastMessage) return "";

  // SDK v6 格式 (parts)
  if (lastMessage.parts) {
    return lastMessage.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("");
  }

  // 旧格式 (content)
  return lastMessage.content || "";
}

/**
 * 构建包含 RAG 上下文的系统提示
 */
export function buildRAGSystemPrompt(
  basePrompt: string,
  ragContext: RAGContext,
): string {
  if (!ragContext.context) {
    return basePrompt;
  }

  return `${basePrompt}

## 知识库相关内容
${ragContext.context}

## 回答规则
1. 优先使用知识库中的信息回答
2. 引用知识库内容时，使用 [1], [2] 等标记
3. 如果知识库内容不足以回答问题，可以结合自身知识补充`;
}

/**
 * 格式化来源引用
 */
export function formatSourcesFooter(sources: RAGSource[]): string {
  if (sources.length === 0) return "";
  return `\n\n---\n参考来源：${sources.map((s) => s.title).join(", ")}`;
}

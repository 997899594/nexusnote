/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * 统一的知识库检索服务，支持：
 * - 带超时的请求
 * - 自动重试
 * - 相似度过滤
 * - 结果格式化
 * - 批量嵌入生成（embedMany）
 */

import { searchNotesAction } from "@/features/learning/actions/note";

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
  private timeout: number;
  private retries: number;
  private similarityThreshold: number;
  private defaultTopK: number;

  constructor(options: RAGServiceOptions = {}) {
    this.timeout = options.timeout || 5000;
    this.retries = options.retries || 2;
    this.similarityThreshold = options.similarityThreshold || 0.3;
    this.defaultTopK = options.defaultTopK || 5;
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
    _userId: string,
    topK: number = this.defaultTopK,
  ): Promise<RAGContext> {
    const emptyResult: RAGContext = { context: "", sources: [], results: [] };

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const result = await searchNotesAction({ query, limit: topK });

        if (!result.success) {
          console.error(
            `[RAG] Search failed (attempt ${attempt + 1}/${this.retries + 1}):`,
            result.error,
          );
          if (attempt < this.retries) continue;
          return emptyResult;
        }

        if (!result.data) {
          return emptyResult;
        }

        const results = result.data as RAGSearchResult[];

        if (results.length === 0) {
          return emptyResult;
        }

        // 过滤低相似度结果
        const relevant = results.filter(
          (r: RAGSearchResult) => r.similarity > this.similarityThreshold,
        );

        if (relevant.length === 0) {
          return emptyResult;
        }

        // 格式化上下文
        const context = relevant
          .map((r: RAGSearchResult, i: number) => `[${i + 1}] ${r.content}`)
          .join("\n\n");

        // 提取来源
        const sources: RAGSource[] = Array.from(
          new Set(relevant.map((r: RAGSearchResult) => r.documentId)),
        ).map((docId) => {
          const match = relevant.find((r: RAGSearchResult) => r.documentId === docId);
          return {
            documentId: docId,
            title: match?.documentTitle || "未知文档",
          };
        });

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
export function buildRAGSystemPrompt(basePrompt: string, ragContext: RAGContext): string {
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

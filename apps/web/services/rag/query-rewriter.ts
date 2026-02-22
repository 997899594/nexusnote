/**
 * RAG Service - Query Rewriter
 *
 * LLM-driven query rewriting to solve:
 * - Deictic queries like "that thing I wrote before"
 * - Colloquial queries with poor vector retrieval performance
 * - Ambiguous queries lacking context
 *
 * Uses fast model for low-latency rewriting, falls back to original query on failure
 */

import { generateText } from "ai";
import { aiProvider } from "@/infrastructure/ai/provider";

export async function rewriteQuery(query: string, conversationContext?: string): Promise<string> {
  // Short queries (< 10 chars) with no context, return as-is
  if (query.length < 10 && !conversationContext) {
    return query;
  }

  try {
    const { text } = await generateText({
      model: aiProvider.chatModel,
      temperature: 0,
      maxOutputTokens: 100,
      system: `你是查询改写器。将用户的口语化查询改写为适合向量检索的关键词查询。
保留核心语义，去除指代词，补充上下文隐含的实体。
只输出改写后的查询，不要解释。`,
      prompt: conversationContext
        ? `对话上下文：${conversationContext}\n用户查询：${query}`
        : `用户查询：${query}`,
    });

    const rewritten = text.trim();
    if (rewritten && rewritten.length <= query.length * 3) {
      return rewritten;
    }
    return query;
  } catch (err) {
    console.warn("[QueryRewriter] Rewrite failed, using original query:", err);
    return query;
  }
}

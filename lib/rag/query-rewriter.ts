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
import { getPlainModelForPolicy } from "@/lib/ai";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";

const QUERY_REWRITER_SYSTEM_PROMPT = loadPromptResource("query-rewriter-system.md");

export async function rewriteQuery(query: string, conversationContext?: string): Promise<string> {
  // Short queries (< 10 chars) with no context, return as-is
  if (query.length < 10 && !conversationContext) {
    return query;
  }

  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "rag:query-rewriter",
    intent: "query-rewrite",
    modelPolicy: "interactive-fast",
    promptVersion: "query-rewriter@v1",
    metadata: {
      hasConversationContext: Boolean(conversationContext),
      queryLength: query.length,
    },
  });

  try {
    const { text, usage } = await generateText({
      model: getPlainModelForPolicy("interactive-fast"),
      temperature: 0,
      maxOutputTokens: 100,
      system: QUERY_REWRITER_SYSTEM_PROMPT,
      prompt: conversationContext
        ? `对话上下文：${conversationContext}\n用户查询：${query}`
        : `用户查询：${query}`,
    });

    await recordAIUsage({
      ...telemetry,
      usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    const rewritten = text.trim();
    if (rewritten && rewritten.length <= query.length * 3) {
      return rewritten;
    }
    return query;
  } catch (err) {
    console.warn("[QueryRewriter] Rewrite failed, using original query:", err);
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(err),
    });
    return query;
  }
}

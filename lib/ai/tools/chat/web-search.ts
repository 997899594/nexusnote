/**
 * Chat Tools - web research search.
 *
 * This is intentionally a thin tool wrapper around the shared research retrieval pipeline.
 */

import { tool } from "ai";
import { z } from "zod";
import { env } from "@/config/env";
import {
  collectResearchEvidence,
  hasResearchProviderConfigured,
} from "@/lib/ai/research/web-research";

const WebSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

export interface WebSearchToolResultItem {
  title: string;
  url: string;
  snippet: string;
  sourceId?: string;
  provider?: string;
  sourceType?: string;
  qualityTier?: string;
  relevanceScore?: number;
}

export interface WebSearchToolOutput {
  success: boolean;
  query: string;
  results: WebSearchToolResultItem[];
  answer?: string | null;
  error?: string;
}

export async function performWebSearch(
  query: string,
  limit: number,
  options?: { userId?: string },
): Promise<WebSearchToolOutput> {
  if (!env.AI_ENABLE_WEB_SEARCH) {
    return {
      success: false,
      error: "联网搜索未启用。请配置 AI_ENABLE_WEB_SEARCH=true。",
      query,
      results: [],
    };
  }

  if (!hasResearchProviderConfigured()) {
    console.warn("[Tool] webSearch: No search API key configured", {
      userId: options?.userId ?? null,
    });
    return {
      success: false,
      error: "搜索服务未配置。请配置 TAVILY_API_KEY、EXA_API_KEY 或 SERPER_API_KEY。",
      query,
      results: [],
    };
  }

  try {
    const output = await collectResearchEvidence({
      query,
      limit,
      maxExtractedSources: Math.min(limit, 6),
      userId: options?.userId,
    });

    return {
      success: output.success,
      query,
      answer: output.answer,
      error: output.success ? undefined : (output.errors[0] ?? "搜索服务暂不可用"),
      results: output.sources.map((source) => ({
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        sourceId: source.sourceId,
        provider: source.provider,
        sourceType: source.sourceType,
        qualityTier: source.qualityTier,
        relevanceScore: source.relevanceScore,
      })),
    };
  } catch (error) {
    console.error("[Tool] webSearch error:", error, {
      userId: options?.userId ?? null,
      query,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "搜索服务暂不可用",
      query,
      results: [],
    };
  }
}

export function createWebSearchTool(userId?: string) {
  return {
    webSearch: tool({
      description: "搜索互联网并读取关键页面正文，返回带 source id 的可追溯来源",
      inputSchema: WebSearchSchema,
      execute: async (args) => performWebSearch(args.query, args.limit, { userId }),
    }),
  };
}

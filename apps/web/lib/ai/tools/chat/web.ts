/**
 * Web Search Skills - Tavily 联网搜索
 *
 * 使用 Tavily API 进行实时网络搜索
 * 相比 302.ai 原生搜索，提供更好的用户体验和可控性
 */

import { env, clientEnv } from "@nexusnote/config";
import { z } from "zod";
import { tool } from "ai";

// ============================================
// Tavily Search Tool
// ============================================

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export const searchWeb = tool({
  description: `用于获取模型训练截止日期之后的最新信息。适用于：1. 事实核查；2. 获取最新技术文档或新闻。**注意：如果知识库中已包含相关信息，优先使用知识库，仅在必要时联网补充。**`,
  inputSchema: z.object({
    query: z.string().describe("搜索查询词，尽量具体和明确"),
    searchDepth: z
      .enum(["basic", "advanced"])
      .default("basic")
      .describe("搜索深度：basic=快速结果，advanced=深度搜索"),
    maxResults: z.number().min(1).max(10).default(5).describe("返回结果数量"),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe("指定搜索的域名（可选）"),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe("排除的域名（可选）"),
  }),
  execute: async ({
    query,
    searchDepth,
    maxResults,
    includeDomains,
    excludeDomains,
  }) => {
    // 检查 API Key
    const apiKey = env.TAVILY_API_KEY;

    if (!apiKey) {
      return {
        query,
        results: [],
        images: [],
        answer: "Web search is disabled (TAVILY_API_KEY not configured).",
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_domains: includeDomains,
          exclude_domains: excludeDomains,
          include_answer: true,
          include_images: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[Tavily] Search failed:", error);
        return {
          success: false,
          query,
          results: [],
          message: `搜索失败：${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        query,
        answer: data.answer || "", // Tavily 生成的答案摘要
        results: (data.results || []).map((r: TavilySearchResult) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          publishedDate: r.published_date,
        })),
        images: data.images || [],
        searchDepth,
      };
    } catch (error) {
      console.error("[Tavily] Search error:", error);
      return {
        success: false,
        query,
        results: [],
        message: error instanceof Error ? error.message : "搜索服务暂时不可用",
      };
    }
  },
});

// ============================================
// Export
// ============================================

export const webSearchSkills = {
  searchWeb,
};

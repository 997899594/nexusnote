/**
 * Chat Tools - 网页搜索
 *
 * 工厂模式：可绑定 userId 用于用量追踪和日志归属
 */

import { tool } from "ai";
import { z } from "zod";

export const WebSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

export type WebSearchInput = z.infer<typeof WebSearchSchema>;

/**
 * 创建网页搜索工具（绑定 userId）
 */
export function createWebSearchTool(userId?: string) {
  return {
    webSearch: tool({
      description: "搜索互联网获取最新信息",
      inputSchema: WebSearchSchema,
      execute: async (args) => {
        const searchApiKey = process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY;

        if (!searchApiKey) {
          console.warn("[Tool] webSearch: No search API key configured", {
            userId: userId ?? null,
          });
          return {
            success: false,
            error: "搜索服务未配置。请联系管理员配置 TAVILY_API_KEY 或 SERPER_API_KEY。",
            query: args.query,
            results: [],
          };
        }

        try {
          if (process.env.TAVILY_API_KEY) {
            return await searchWithTavily(args.query, args.limit);
          }

          if (process.env.SERPER_API_KEY) {
            return await searchWithSerper(args.query, args.limit);
          }

          return { success: false, error: "搜索服务配置错误", results: [] };
        } catch (error) {
          console.error("[Tool] webSearch error:", error, { userId: userId ?? null });
          return {
            success: false,
            error: error instanceof Error ? error.message : "搜索服务暂不可用",
            results: [],
          };
        }
      },
    }),
  };
}

/**
 * 使用 Tavily API 搜索
 */
async function searchWithTavily(query: string, limit: number) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: limit,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    success: true,
    query,
    answer: data.answer || null,
    results: (data.results || []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    })),
  };
}

/**
 * 使用 Serper API 搜索
 */
async function searchWithSerper(query: string, limit: number) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY!,
    },
    body: JSON.stringify({
      q: query,
      num: limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    success: true,
    query,
    results: (data.organic || []).map((r: { title: string; link: string; snippet: string }) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    })),
  };
}

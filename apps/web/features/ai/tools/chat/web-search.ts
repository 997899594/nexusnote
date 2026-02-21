/**
 * Chat Tools - 网页搜索
 */

import { tool } from "ai";
import { z } from "zod";

export const WebSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

export type WebSearchInput = z.infer<typeof WebSearchSchema>;

export const webSearchTool = tool({
  description: "搜索互联网获取最新信息",
  inputSchema: WebSearchSchema,
  execute: async (args) => {
    try {
      // TODO: 使用真实的搜索 API (Tavily, Serper, etc.)
      // 目前返回模拟数据
      console.log("[Tool] webSearch:", args.query);

      return {
        success: true,
        query: args.query,
        results: [
          {
            title: `${args.query} - 搜索结果 1`,
            url: "https://example.com/1",
            snippet: "这是搜索结果的摘要内容...",
          },
        ],
      };
    } catch (error) {
      console.error("[Tool] webSearch error:", error);
      return {
        success: false,
        error: "搜索服务暂不可用",
      };
    }
  },
});

/**
 * RAG Tools - 混合搜索
 */

import { tool } from "ai";
import { z } from "zod";
import { hybridSearch } from "../../rag/hybrid-search";

export const HybridSearchSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(5),
});

export type HybridSearchInput = z.infer<typeof HybridSearchSchema>;

export const hybridSearchTool = tool({
  description: "在用户知识库中进行混合搜索（向量+关键词），获取最相关的内容片段。",
  inputSchema: HybridSearchSchema,
  execute: async (args) => {
    try {
      const results = await hybridSearch(args.query, args.topK);
      return {
        success: true,
        query: args.query,
        count: results.length,
        results: results.map((r) => ({
          id: r.id,
          documentId: r.documentId,
          content: r.content.slice(0, 500),
          score: Math.round(r.score * 100) / 100,
          source: r.source,
        })),
      };
    } catch (error) {
      console.error("[RAG Tool] error:", error);
      return {
        success: false,
        query: args.query,
        results: [],
        error: "搜索服务暂不可用",
      };
    }
  },
});

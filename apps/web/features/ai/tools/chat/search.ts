/**
 * Chat Tools - 搜索笔记
 */

import { db, documents, eq } from "@nexusnote/db";
import { tool } from "ai";
import { z } from "zod";
import { hybridSearch } from "../../rag/hybrid-search";

export const SearchNotesSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(10),
});

export type SearchNotesInput = z.infer<typeof SearchNotesSchema>;

export const searchNotesTool = tool({
  description:
    '在用户的笔记/文档库中搜索相关内容。当用户问"我之前写过什么关于..."、"搜索笔记"时调用。',
  inputSchema: SearchNotesSchema,
  execute: async (args) => {
    try {
      const results = await hybridSearch(args.query, args.limit);

      if (results.length === 0) {
        return {
          success: true,
          query: args.query,
          results: [],
          message: "未找到相关内容",
        };
      }

      const documentIds = [...new Set(results.map((r) => r.documentId))];
      const docs = await db.query.documents.findMany({
        where: (docs, { inArray }) => inArray(docs.id, documentIds),
      });

      const docMap = new Map(docs.map((d) => [d.id, d.title]));

      return {
        success: true,
        query: args.query,
        count: results.length,
        results: results.map((r) => ({
          id: r.id,
          documentId: r.documentId,
          title: docMap.get(r.documentId) || "未知文档",
          content: r.content,
          relevance: Math.round(r.score * 100),
          source: r.source,
        })),
      };
    } catch (error) {
      console.error("[Tool] searchNotes error:", error);
      return {
        success: false,
        query: args.query,
        results: [],
        error: "搜索服务暂不可用",
      };
    }
  },
});

/**
 * Chat Tools - 搜索笔记
 */

import { db, documents, eq } from "@/db";
import { tool } from "ai";
import { z } from "zod";
import { hybridSearch } from "@/services/rag";

export const SearchNotesSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(10),
  sourceTypes: z.array(z.enum(["document", "conversation"])).optional(),
});

export type SearchNotesInput = z.infer<typeof SearchNotesSchema>;

export const searchNotesTool = tool({
  description:
    '在用户的笔记/文档库中搜索相关内容。当用户问"我之前写过什么关于..."、"搜索笔记"时调用。',
  inputSchema: SearchNotesSchema,
  execute: async (args) => {
    try {
      const results = await hybridSearch({
        query: args.query,
        topK: args.limit,
        sourceTypes: args.sourceTypes,
      });

      if (results.length === 0) {
        return {
          success: true,
          query: args.query,
          results: [],
          message: "未找到相关内容",
        };
      }

      const documentSourceIds = results
        .filter((r) => r.sourceType === "document")
        .map((r) => r.sourceId);

      const docs =
        documentSourceIds.length > 0
          ? await db.query.documents.findMany({
              where: (docs, { inArray }) => inArray(docs.id, documentSourceIds),
            })
          : [];

      const docMap = new Map(docs.map((d) => [d.id, d.title]));

      return {
        success: true,
        query: args.query,
        count: results.length,
        results: results.map((r) => ({
          id: r.id,
          sourceId: r.sourceId,
          sourceType: r.sourceType,
          title: r.sourceType === "document" ? docMap.get(r.sourceId) || "未知文档" : "聊天记录",
          content: r.content.slice(0, 300),
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

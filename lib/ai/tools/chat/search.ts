/**
 * Chat Tools - 搜索笔记
 *
 * 工厂模式：通过闭包绑定 userId
 */

import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import {
  expandNoteBackedKnowledgeSourceTypes,
  isNoteBackedKnowledgeSourceType,
  NOTE_KNOWLEDGE_SOURCE_TYPE,
} from "@/lib/knowledge/source-types";
import { hybridSearch, type SourceType } from "@/lib/rag";

export const SearchNotesSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(10),
  sourceTypes: z.array(z.enum(["note", "conversation"])).optional(),
});

export type SearchNotesInput = z.infer<typeof SearchNotesSchema>;

/**
 * 创建搜索工具（带 userId 权限验证）
 */
export function createSearchTools(userId: string) {
  return {
    searchNotes: tool({
      description:
        '在用户的笔记/文档库中搜索相关内容。当用户问"我之前写过什么关于..."、"搜索笔记"时调用。',
      inputSchema: SearchNotesSchema,
      execute: async (args) => {
        try {
          const effectiveSourceTypes: SourceType[] = (expandNoteBackedKnowledgeSourceTypes(
            args.sourceTypes,
          ) as SourceType[] | undefined) ?? [NOTE_KNOWLEDGE_SOURCE_TYPE, "conversation"];
          const results = await hybridSearch({
            query: args.query,
            topK: args.limit,
            sourceTypes: effectiveSourceTypes,
            userId, // 权限验证
          });

          if (results.length === 0) {
            return {
              success: true,
              query: args.query,
              results: [],
              message: "未找到相关内容",
            };
          }

          const noteSourceIds = results
            .filter((r) => isNoteBackedKnowledgeSourceType(r.sourceType))
            .map((r) => r.sourceId);

          const foundNotes =
            noteSourceIds.length > 0
              ? await db.query.notes.findMany({
                  where: (table, { and, eq, inArray }) =>
                    and(eq(table.userId, userId), inArray(table.id, noteSourceIds)),
                })
              : [];

          const noteMap = new Map(foundNotes.map((note) => [note.id, note.title]));

          return {
            success: true,
            query: args.query,
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              sourceId: r.sourceId,
              sourceType: r.sourceType,
              title: isNoteBackedKnowledgeSourceType(r.sourceType)
                ? noteMap.get(r.sourceId) || "未知笔记"
                : "聊天记录",
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
    }),
  };
}

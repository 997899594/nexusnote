/**
 * RAG Tools - 混合搜索
 *
 * 工厂模式：通过闭包绑定 userId
 */

import { tool } from "ai";
import { z } from "zod";
import { expandNoteBackedKnowledgeSourceTypes } from "@/lib/knowledge/source-types";
import { hybridSearch, type SourceType } from "@/lib/rag";

export const HybridSearchSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(5),
  sourceTypes: z.array(z.enum(["note", "conversation", "course_section"])).optional(),
});

export type HybridSearchInput = z.infer<typeof HybridSearchSchema>;

/**
 * 创建 RAG 工具（带 userId 权限验证）
 */
export function createRagTools(userId: string) {
  return {
    hybridSearch: tool({
      description:
        "在用户知识库中进行混合搜索（向量+关键词），获取最相关的内容片段。可指定来源类型：note（笔记）、conversation（聊天）或 course_section（课程内容）。不指定则搜索全部类型。",
      inputSchema: HybridSearchSchema,
      execute: async (args) => {
        try {
          const effectiveSourceTypes = expandNoteBackedKnowledgeSourceTypes(args.sourceTypes) as
            | SourceType[]
            | undefined;
          const results = await hybridSearch({
            query: args.query,
            topK: args.topK,
            sourceTypes: effectiveSourceTypes,
            userId, // 权限验证
          });
          return {
            success: true,
            query: args.query,
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              sourceId: r.sourceId,
              sourceType: r.sourceType,
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
    }),
  };
}

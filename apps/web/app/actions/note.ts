"use server";

/**
 * 2026 架构师标准：Note Server Actions
 *
 * 职责：
 * 1. 替代 /api/notes/* 路由
 * 2. 提供类型安全的主题和笔记数据获取
 */

import {
  db,
  topics,
  extractedNotes,
  eq,
  desc,
  documentChunks,
  documents,
  sql,
  and,
} from "@nexusnote/db";
import { createSafeAction } from "@/lib/actions/action-utils";
import { z } from "zod";
import { auth } from "@/auth";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { TopicDTO, NoteDTO } from "@/lib/actions/types";

/**
 * 搜索笔记 - 语义搜索 (RAG)
 */
export const searchNotesAction = createSafeAction(
  z.object({
    query: z.string(),
    limit: z.number().optional().default(5),
  }),
  async ({ query, limit }, userId) => {
    // 1. 生成查询向量
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: query,
    });

    // 2. 执行向量相似度搜索
    // 相似度 = 1 - (embedding <=> query_embedding)
    // <=> 是 pgvector 的余弦距离操作符
    const vectorStr = `[${embedding.join(",")}]`;

    const results = await db.execute(sql`
      SELECT 
        dc.content,
        dc.document_id as "documentId",
        d.title as "documentTitle",
        1 - (dc.embedding <=> ${vectorStr}::halfvec) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = ${userId}
      ORDER BY dc.embedding <=> ${vectorStr}::halfvec
      LIMIT ${limit}
    `);

    return results as unknown as Array<{
      content: string;
      documentId: string;
      documentTitle: string;
      similarity: number;
    }>;
  },
);

/**
 * 获取用户的所有主题及其关联的笔记
 */
export const getNoteTopicsAction = createSafeAction(
  "getNoteTopics",
  async (_, userId): Promise<{ topics: TopicDTO[] }> => {
    // 1. 获取所有主题
    const allTopics = await db.query.topics.findMany({
      where: eq(topics.userId, userId),
      orderBy: [desc(topics.lastActiveAt)],
      with: {
        notes: {
          orderBy: [desc(extractedNotes.createdAt)],
          limit: 10,
        },
      },
    });

    // 2026 架构师建议：在服务端进行数据映射，返回 UI Ready 的 DTO
    return {
      topics: allTopics.map(
        (t): TopicDTO => ({
          id: t.id,
          name: t.name,
          noteCount: t.noteCount || 0,
          lastActiveAt: t.lastActiveAt ? t.lastActiveAt.toISOString() : null,
          notes: t.notes?.map(
            (n): NoteDTO => ({
              id: n.id,
              content: n.content,
              createdAt: n.createdAt
                ? n.createdAt.toISOString()
                : new Date().toISOString(),
              title:
                n.content.slice(0, 30) + (n.content.length > 30 ? "..." : ""),
            }),
          ),
        }),
      ),
    };
  },
);

/**
 * 获取特定主题下的所有笔记
 */
export const getTopicNotesAction = createSafeAction(
  "getTopicNotes",
  async (topicId: string, userId) => {
    const notes = await db.query.extractedNotes.findMany({
      where: (fields, { and, eq }) =>
        and(eq(fields.topicId, topicId), eq(fields.userId, userId)),
      orderBy: [desc(extractedNotes.createdAt)],
    });

    return { notes };
  },
);

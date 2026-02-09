/**
 * Course Types - NexusNote 2026
 *
 * Shared types for course generation and learning.
 * This file contains ONLY types - no database imports.
 * Safe to import in both server and client code.
 */

import { z } from "zod";

/**
 * 课程大纲数据结构（Interview Agent 生成）
 * Tiptap 可以直接渲染 JSON 或 Markdown
 */
export const OutlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number().min(30),
  modules: z
    .array(
      z.object({
        title: z.string(),
        chapters: z.array(
          z.object({
            title: z.string(),
            contentSnippet: z.string().optional(),
          }),
        ),
      }),
    )
    .optional(),
  reason: z.string().optional(),
  // 工具返回的额外字段
  status: z.string().optional(),
  replyToUser: z.string().optional(),
}).passthrough(); // 允许额外属性通过

export type OutlineData = z.infer<typeof OutlineSchema>;

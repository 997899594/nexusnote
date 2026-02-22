/**
 * Tiptap JSON Schema Types - 2026 Modern Architecture
 *
 * 使用官方 @tiptap/core 的 JSONContent 类型
 * 用于 AI 结构化内容生成 (streamObject)
 */

import type { JSONContent } from "@tiptap/core";
import { z } from "zod";

/**
 * Tiptap JSONContent - 官方类型
 * 用于流式生成结构化文档内容
 */
export type { JSONContent } from "@tiptap/core";

/**
 * Flashcard Schema - 闪卡
 */
export const FlashcardSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe("卡片正面内容"),
      back: z.string().describe("卡片背面内容"),
    }),
  ),
});

export type FlashcardOutput = z.infer<typeof FlashcardSchema>;

/**
 * Quiz Schema - 测验题
 */
export const QuizSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string().describe("题目ID"),
      type: z.enum(["single", "multiple", "true-false"]).describe("题目类型"),
      question: z.string().describe("问题内容"),
      options: z.array(z.string()).describe("选项列表"),
      answer: z.union([z.string(), z.array(z.string())]).describe("正确答案"),
      explanation: z.string().optional().describe("答案解析"),
    }),
  ),
  difficulty: z.enum(["easy", "medium", "hard"]).describe("难度级别"),
});

export type QuizOutput = z.infer<typeof QuizSchema>;

/**
 * MindMap Schema - 思维导图
 */
const MindMapNodeSchema: z.ZodType<{
  id: string;
  text: string;
  children?: { id: string; text: string; children?: any }[];
}> = z.lazy(() =>
  z.object({
    id: z.string().describe("节点ID"),
    text: z.string().describe("节点文本"),
    children: z.array(MindMapNodeSchema).optional(),
  }),
);

export const MindMapSchema = z.object({
  root: z.object({
    id: z.string().describe("根节点ID"),
    text: z.string().describe("中心主题"),
    children: z.array(MindMapNodeSchema).optional(),
  }),
});

export type MindMapOutput = z.infer<typeof MindMapSchema>;

/**
 * Summary Schema - 摘要
 */
export const SummarySchema = z.object({
  title: z.string().describe("摘要标题"),
  keyPoints: z.array(z.string()).describe("关键要点列表"),
  summary: z.string().describe("完整摘要"),
  tags: z.array(z.string()).optional().describe("标签"),
});

export type SummaryOutput = z.infer<typeof SummarySchema>;

/**
 * Course Content Schema - 课程内容 (Tiptap JSON)
 */
export const CourseContentSchema = z.object({
  title: z.string().describe("课程标题"),
  chapters: z.array(
    z.object({
      title: z.string().describe("章节标题"),
      content: z.string().describe("章节内容 (Markdown)"),
      duration: z.number().describe("预估时长(分钟)"),
    }),
  ),
});

export type CourseContentOutput = z.infer<typeof CourseContentSchema>;

/**
 * Document Edit Schema - 文档编辑
 */
export const DocumentEditSchema = z.object({
  operation: z.enum(["insert", "replace", "delete"]),
  position: z.number().describe("操作位置"),
  content: z.string().describe("插入/替换的内容"),
  length: z.number().optional().describe("删除长度"),
});

export type DocumentEditOutput = z.infer<typeof DocumentEditSchema>;

/**
 * AI Response Schema - 通用 AI 响应
 */
export const AIResponseSchema = z.object({
  content: z.string().describe("响应内容"),
  suggestions: z.array(z.string()).optional().describe("建议操作"),
  references: z.array(z.string()).optional().describe("参考来源"),
});

export type AIResponseOutput = z.infer<typeof AIResponseSchema>;

/**
 * 工具输出类型映射
 */
export type ToolOutput<T extends string> = T extends "flashcard"
  ? FlashcardOutput
  : T extends "quiz"
    ? QuizOutput
    : T extends "mindmap"
      ? MindMapOutput
      : T extends "summary"
        ? SummaryOutput
        : T extends "course"
          ? CourseContentOutput
          : T extends "edit"
            ? DocumentEditOutput
            : AIResponseOutput;

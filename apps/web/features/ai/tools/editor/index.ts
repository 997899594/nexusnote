/**
 * Editor Tools - 文档编辑
 */

import { tool } from "ai";
import { z } from "zod";

const editActionSchema = z.enum([
  "replace",
  "replace_all",
  "insert_after",
  "insert_before",
  "delete",
]);

export const editDocumentTool = tool({
  description: `用于对现有文档进行微创手术（修改、删除、插入）。适用于：1. 修正错别字或语病；2. 调整段落顺序。**注意：不要用于生成长篇新内容，长内容请使用 draftContent。**`,
  inputSchema: z.object({
    action: editActionSchema.describe("编辑操作类型"),
    targetId: z.string().describe('目标块ID（如 p-0, h-1）或 "document" 表示全文'),
    newContent: z.string().optional().describe("新内容（Markdown 格式）"),
    explanation: z.string().describe("简要说明这次编辑做了什么"),
  }),
  execute: async ({ action, targetId, newContent, explanation }) => {
    return {
      success: true,
      action,
      targetId,
      newContent,
      explanation,
      requiresConfirmation: true,
    };
  },
});

export const batchEditTool = tool({
  description: "一次性对文档进行多处修改。当用户请求的修改涉及多个位置时使用。",
  inputSchema: z.object({
    edits: z
      .array(
        z.object({
          action: editActionSchema,
          targetId: z.string(),
          newContent: z.string().optional(),
        }),
      )
      .describe("编辑操作列表"),
    explanation: z.string().describe("整体修改说明"),
  }),
  execute: async ({ edits, explanation }) => {
    return {
      success: true,
      edits,
      explanation,
      requiresConfirmation: true,
    };
  },
});

export const draftContentTool = tool({
  description: `用于生成长文本草稿。适用于：1. 用户要求扩写整段内容；2. 生成新的章节。前端将渲染为"预览卡片"供用户确认。`,
  inputSchema: z.object({
    content: z.string().describe("生成的长文本内容（Markdown 格式）"),
    targetId: z.string().optional().describe("建议插入的位置ID（可选）"),
    explanation: z.string().describe("说明这段内容是关于什么的"),
  }),
  execute: async ({ content, targetId, explanation }) => {
    return {
      success: true,
      content,
      targetId,
      explanation,
      requiresConfirmation: true,
    };
  },
});

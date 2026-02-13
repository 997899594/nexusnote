/**
 * Editor Skills - 文档编辑工具
 *
 * 基于 Vercel AI SDK 6.x 的结构化编辑工具
 * 替代脆弱的 <<<EDIT_START>>> 正则解析模式
 *
 * 设计原则：
 * - 结构化操作（删除、移动、替换）→ 使用 Tool Calling
 * - 长内容生成（扩写、续写）→ 保留 Text Stream（在 prompt 中处理）
 */

import { tool } from "ai";
import { z } from "zod";

// ============================================
// Edit Action Schema
// ============================================

const editActionSchema = z.enum([
  "replace", // 替换指定块的内容
  "replace_all", // 替换整个文档
  "insert_after", // 在指定块后插入
  "insert_before", // 在指定块前插入
  "delete", // 删除指定块
]);

// ============================================
// Editor Tools
// ============================================

/**
 * 编辑文档 - 对当前文档进行结构化编辑
 *
 * 这个工具在前端执行（onToolCall），不需要服务端处理
 * 返回的数据用于前端显示预览和确认
 */
export const editDocument = tool({
  description: `用于对现有文档进行微创手术（修改、删除、插入）。适用于：1. 修正错别字或语病；2. 调整段落顺序。**注意：不要用于生成长篇新内容，长内容请使用 draftContent。**`,
  inputSchema: z.object({
    action: editActionSchema.describe("编辑操作类型"),
    targetId: z.string().describe('目标块ID（如 p-0, h-1）或 "document" 表示全文'),
    newContent: z.string().optional().describe("新内容（Markdown 格式）"),
    explanation: z.string().describe("简要说明这次编辑做了什么"),
  }),
  execute: async ({ action, targetId, newContent, explanation }) => {
    // 工具在前端执行，这里只返回确认信息
    // 实际的编辑操作由前端的 onToolCall 处理
    return {
      success: true,
      action,
      targetId,
      newContent,
      explanation,
      // 标记这是一个需要用户确认的编辑操作
      requiresConfirmation: true,
    };
  },
});

/**
 * 批量编辑 - 一次性进行多处修改
 */
export const batchEdit = tool({
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

/**
 * 草稿生成 - 用于生成长篇内容供用户预览
 */
export const draftContent = tool({
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
      requiresConfirmation: true, // 同样需要确认
    };
  },
});

// ============================================
// Export
// ============================================

export const editorSkills = {
  editDocument,
  batchEdit,
  draftContent,
};

export type EditorSkillName = keyof typeof editorSkills;

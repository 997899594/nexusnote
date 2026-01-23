/**
 * Editor Tools
 *
 * 编辑器操作工具
 * 通过 EditorContext 操作文档
 */

import { z } from 'zod'
import { defineTool } from '../types'
import type { EditCommand } from '@nexusnote/types'

/**
 * 应用编辑命令
 *
 * 注意：实际执行需要 EditorContext
 * 这里返回待确认的编辑命令，由 UI 层处理
 */
export const applyEdit = defineTool({
  name: 'applyEdit',
  description: '应用编辑命令到当前文档（替换/插入/删除）',
  category: 'editor',
  inputSchema: z.object({
    action: z.enum(['replace', 'insert_after', 'insert_before', 'delete', 'replace_all'])
      .describe('编辑操作类型'),
    targetId: z.string().describe('目标块 ID（如 p-0, h-1）或 "document"'),
    newContent: z.string().optional().describe('新内容（Markdown 格式）'),
    explanation: z.string().optional().describe('编辑说明'),
  }),
  requiresConfirmation: true,
  sideEffects: true,
  execute: async (input, context) => {
    // 构建编辑命令
    const command: EditCommand = {
      action: input.action,
      targetId: input.targetId,
      newContent: input.newContent,
      explanation: input.explanation,
    }

    // 验证：非删除操作需要 newContent
    if (input.action !== 'delete' && !input.newContent) {
      return {
        success: false,
        error: 'newContent is required for non-delete operations',
      }
    }

    // 返回待确认的编辑命令
    // 实际应用由 UI 层的 EditorContext 处理
    return {
      success: true,
      requiresConfirmation: !context.config.autoApplyEdits,
      pendingData: command,
      data: {
        message: context.config.autoApplyEdits
          ? 'Edit will be applied automatically'
          : 'Edit pending confirmation',
        command,
      },
    }
  },
  examples: [{
    description: '替换第一段内容',
    input: {
      action: 'replace',
      targetId: 'p-0',
      newContent: '这是新的段落内容...',
      explanation: '改写为更正式的语气',
    },
    output: { success: true, requiresConfirmation: true },
  }],
})

/**
 * 获取文档结构
 */
export const getDocumentStructure = defineTool({
  name: 'getDocumentStructure',
  description: '获取当前文档的结构化信息（块列表、标题、段落）',
  category: 'editor',
  inputSchema: z.object({}),
  execute: async (_, context) => {
    if (!context.document) {
      return {
        success: false,
        error: 'No document in context. Please open a document first.',
      }
    }

    const { structure } = context.document

    return {
      success: true,
      data: {
        totalBlocks: structure.totalBlocks,
        headings: structure.headings.map(h => ({
          id: h.id,
          level: h.level,
          content: h.content.slice(0, 50),
        })),
        paragraphs: structure.paragraphs.map(p => ({
          id: p.id,
          content: p.content.slice(0, 100) + (p.content.length > 100 ? '...' : ''),
        })),
        summary: `文档包含 ${structure.headings.length} 个标题和 ${structure.paragraphs.length} 个段落`,
      },
    }
  },
})

/**
 * 批量应用编辑
 */
export const applyEdits = defineTool({
  name: 'applyEdits',
  description: '批量应用多个编辑命令',
  category: 'editor',
  inputSchema: z.object({
    edits: z.array(z.object({
      action: z.enum(['replace', 'insert_after', 'insert_before', 'delete', 'replace_all']),
      targetId: z.string(),
      newContent: z.string().optional(),
      explanation: z.string().optional(),
    })).describe('编辑命令列表'),
  }),
  requiresConfirmation: true,
  sideEffects: true,
  execute: async ({ edits }, context) => {
    const commands: EditCommand[] = edits.map(e => ({
      action: e.action,
      targetId: e.targetId,
      newContent: e.newContent,
      explanation: e.explanation,
    }))

    return {
      success: true,
      requiresConfirmation: !context.config.autoApplyEdits,
      pendingData: commands,
      data: {
        message: `${commands.length} edits pending`,
        count: commands.length,
        commands,
      },
    }
  },
})

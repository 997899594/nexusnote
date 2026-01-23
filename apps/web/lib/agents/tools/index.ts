/**
 * Agent Tools
 *
 * 统一工具导出和初始化
 * 包括迁移现有 Skills 到 ToolRegistry
 */

export * from './types'
export * from './tool-registry'

// 工具分类导出
export * from './storage/document-tools'
export * from './editor/edit-tools'
export * from './knowledge/rag-tools'

import { z } from 'zod'
import { toolRegistry } from './tool-registry'
import { skills } from '@/lib/ai/skills'
import { defineTool } from './types'

// 存储工具
import {
  readDocument,
  listDocuments,
  searchDocumentsLocal,
} from './storage/document-tools'

// 编辑器工具
import {
  applyEdit,
  getDocumentStructure,
} from './editor/edit-tools'

// 知识工具
import {
  semanticSearch,
  findRelatedNotes,
} from './knowledge/rag-tools'

/**
 * 初始化 ToolRegistry
 * 注册所有内置工具 + 迁移现有 Skills
 */
export function initializeTools(): void {
  // 1. 注册存储工具
  toolRegistry.register(readDocument)
  toolRegistry.register(listDocuments)
  toolRegistry.register(searchDocumentsLocal)

  // 2. 注册编辑器工具
  toolRegistry.register(applyEdit)
  toolRegistry.register(getDocumentStructure)

  // 3. 注册知识工具
  toolRegistry.register(semanticSearch)
  toolRegistry.register(findRelatedNotes)

  // 4. 迁移现有 Skills
  migrateExistingSkills()

  console.log(`[ToolRegistry] Initialized with ${toolRegistry.size()} tools`)
}

/**
 * 迁移现有 AI Skills 到 ToolRegistry
 * AI SDK 6.x 使用 inputSchema，需要重新定义 schema
 */
function migrateExistingSkills(): void {
  // createFlashcards
  toolRegistry.register(defineTool({
    name: 'createFlashcards',
    description: '从用户提供的内容创建闪卡',
    category: 'ai',
    inputSchema: z.object({
      cards: z.array(z.object({
        front: z.string().describe('卡片正面（问题/提示）'),
        back: z.string().describe('卡片背面（答案/解释）'),
      })).describe('要创建的闪卡列表'),
      context: z.string().optional().describe('内容来源的上下文'),
    }),
    execute: async (input, _context) => {
      try {
        const result = await (skills.createFlashcards as any).execute(input)
        return { success: true, data: result }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create flashcards',
        }
      }
    },
    examples: [{
      description: '从文本创建闪卡',
      input: {
        cards: [{ front: '什么是 RAG?', back: '检索增强生成' }],
      },
      output: { success: true, count: 1 },
    }],
  }))

  // getReviewStats
  toolRegistry.register(defineTool({
    name: 'getReviewStats',
    description: '获取用户的闪卡复习统计',
    category: 'ai',
    inputSchema: z.object({}),
    execute: async (input, _context) => {
      try {
        const result = await (skills.getReviewStats as any).execute(input)
        return { success: true, data: result }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get stats',
        }
      }
    },
  }))

  // createLearningPlan
  toolRegistry.register(defineTool({
    name: 'createLearningPlan',
    description: '为用户生成学习计划',
    category: 'ai',
    inputSchema: z.object({
      topic: z.string().describe('学习主题'),
      duration: z.string().optional().describe('学习时长'),
      level: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe('难度级别'),
    }),
    execute: async (input, _context) => {
      try {
        const result = await (skills.createLearningPlan as any).execute(input)
        return { success: true, data: result }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create plan',
        }
      }
    },
  }))

  console.log('[ToolRegistry] Migrated existing Skills')
}

// 自动初始化（仅在浏览器环境）
if (typeof window !== 'undefined') {
  // 延迟初始化，确保依赖加载完成
  setTimeout(() => {
    initializeTools()
  }, 0)
}

/**
 * Learning Enhancement Skills - 学习增强工具
 *
 * AI SDK 6.x 工具集，增强学习体验
 * 集成 LLM 内容生成服务，实现生产级质量
 */

import { z } from 'zod'
import { tool } from 'ai'
import {
  generateQuizQuestions as llmGenerateQuizQuestions,
  generateMindMapNodes as llmGenerateMindMapNodes,
  generateSummaryContent as llmGenerateSummaryContent,
  streamQuizQuestions,
  streamMindMapNodes,
  type QuizQuestion,
  type MindMapNodeData,
} from '../tool-content-service'

// ============================================
// Types - 类型定义
// ============================================

export interface Question {
  id: number
  type: 'multiple_choice' | 'true_false' | 'fill_blank'
  question: string
  options?: string[]
  answer: string | number
  explanation?: string
}

export interface QuizData {
  topic: string
  difficulty: string
  questions: Question[]
}

export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  color?: string
}

// ============================================
// Quiz Generation - 测验生成
// ============================================

export const generateQuiz = tool({
  description: `用于将被动阅读转化为主动回忆 (Active Recall)。
  适用于：1. 用户刚阅读完长难章节；2. 用户表示"懂了"但你怀疑其掌握程度时。
  **请主动使用此工具来验证用户的理解，无需等待指令。**

  工具会自动生成交互式测验题目，包括单选题、判断题和填空题。
  使用 LLM 智能分析内容并生成高质量题目。`,
  inputSchema: z.object({
    content: z.string().describe('要测试的内容或主题'),
    questionCount: z.number().min(1).max(10).default(5).describe('题目数量'),
    difficulty: z
      .enum(['easy', 'medium', 'hard'])
      .default('medium')
      .describe('难度级别'),
    types: z
      .array(z.enum(['multiple_choice', 'true_false', 'fill_blank']))
      .optional()
      .describe('题型，不指定则混合'),
  }),
  execute: async ({ content, questionCount, difficulty, types }) => {
    // 调用 LLM 服务生成题目
    const questions = await llmGenerateQuizQuestions(content, questionCount, difficulty, types)

    const topic = content.length > 50 ? content.slice(0, 47) + '...' : content

    return {
      success: true,
      quiz: {
        topic,
        difficulty,
        questionCount: questions.length,
        questions, // 返回完整题目数据供前端渲染
      },
    }
  },
})

// ============================================
// Mind Map - 思维导图
// ============================================

export const mindMap = tool({
  description: `用于将非结构化的文本转化为结构化图谱。
  适用于：1. 解释复杂的系统架构或家族树；2. 用户似乎迷失在长文本中，需要全局视角时。
  **请主动使用此工具来辅助你的解释，无需等待指令。**

  工具会自动生成交互式思维导图，支持拖拽、缩放和多种布局模式。
  使用 LLM 智能分析内容结构并生成层次化节点。`,
  inputSchema: z.object({
    topic: z.string().describe('中心主题'),
    content: z.string().optional().describe('要组织的内容（可选）'),
    maxDepth: z.number().min(1).max(4).default(3).describe('最大层级深度'),
    layout: z
      .enum(['radial', 'tree', 'mindmap'])
      .default('mindmap')
      .describe('布局类型'),
  }),
  execute: async ({ topic, content, maxDepth, layout }) => {
    // 调用 LLM 服务生成节点
    const nodes = await llmGenerateMindMapNodes(topic, content, maxDepth)

    return {
      success: true,
      mindMap: {
        topic,
        maxDepth,
        layout,
        hasContent: !!content,
        nodes, // 返回完整节点数据供前端渲染
      },
    }
  },
})

// ============================================
// Summarize - 智能摘要
// ============================================

export const summarize = tool({
  description: `用于降低认知负荷。
  适用于：1. 用户面对长文档显得不知所措；2. 需要快速回顾前文要点时。

  工具会自动生成智能摘要，支持要点列表、段落和核心要点三种风格。
  使用 LLM 智能提取关键信息并生成高质量摘要。`,
  inputSchema: z.object({
    content: z.string().describe('要摘要的内容'),
    length: z
      .enum(['brief', 'medium', 'detailed'])
      .default('medium')
      .describe('摘要长度：brief=1-2句，medium=段落，detailed=多段落'),
    style: z
      .enum(['bullet_points', 'paragraph', 'key_takeaways'])
      .default('bullet_points')
      .describe('摘要风格'),
    preserveStructure: z
      .boolean()
      .default(false)
      .describe('是否保留原文结构（章节标题等）'),
    language: z
      .enum(['zh', 'en', 'auto'])
      .default('auto')
      .describe('摘要语言'),
  }),
  execute: async ({ content, length, style, preserveStructure, language }) => {
    // 调用 LLM 服务生成摘要
    const summaryContent = await llmGenerateSummaryContent(content, length, style)

    const wordCounts = {
      brief: '50-100',
      medium: '150-300',
      detailed: '300-500',
    }

    return {
      success: true,
      summary: {
        sourceLength: content.length,
        targetLength: wordCounts[length],
        length,
        style,
        preserveStructure,
        language,
        content: summaryContent, // 返回实际摘要内容供前端渲染
      },
    }
  },
})

// ============================================
// Export - 导出工具和流式函数
// ============================================

export const learningSkills = {
  generateQuiz,
  mindMap,
  summarize,
}

// 导出流式生成函数供前端使用
export {
  streamQuizQuestions,
  streamMindMapNodes,
}

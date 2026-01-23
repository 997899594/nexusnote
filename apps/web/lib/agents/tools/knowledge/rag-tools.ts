/**
 * Knowledge Tools
 *
 * RAG 检索和知识关联工具
 */

import { z } from 'zod'
import { defineTool } from '../types'
import { API_URL, config } from '@/lib/config'

/**
 * 语义搜索
 */
export const semanticSearch = defineTool({
  name: 'semanticSearch',
  description: '使用 RAG 进行语义搜索知识库（需要网络）',
  category: 'knowledge',
  inputSchema: z.object({
    query: z.string().describe('搜索查询'),
    topK: z.number().optional().default(5).describe('返回结果数量'),
    threshold: z.number().optional().default(0.3).describe('相似度阈值'),
  }),
  offlineSupport: false,
  execute: async ({ query, topK, threshold }) => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.rag.timeout)

      const response = await fetch(
        `${API_URL}/rag/search?q=${encodeURIComponent(query)}&topK=${topK}`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          error: `RAG service error: ${response.status}`,
        }
      }

      const results = await response.json() as Array<{
        content: string
        documentId: string
        documentTitle: string
        similarity: number
      }>

      // 过滤低相似度结果
      const filtered = results.filter(r => r.similarity >= threshold)

      return {
        success: true,
        data: {
          results: filtered.map(r => ({
            content: r.content,
            documentId: r.documentId,
            documentTitle: r.documentTitle,
            relevance: Math.round(r.similarity * 100),
          })),
          total: filtered.length,
          query,
        },
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Search timeout' }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }
    }
  },
  examples: [{
    description: '搜索 RAG 相关内容',
    input: { query: 'RAG 检索增强生成', topK: 5 },
    output: {
      success: true,
      data: {
        results: [{
          content: 'RAG 是一种...',
          documentId: 'doc-1',
          documentTitle: 'AI 笔记',
          relevance: 85,
        }],
        total: 1,
      },
    },
  }],
})

/**
 * 找到相关笔记
 */
export const findRelatedNotes = defineTool({
  name: 'findRelatedNotes',
  description: '找到与指定内容相关的笔记',
  category: 'knowledge',
  inputSchema: z.object({
    content: z.string().describe('参考内容'),
    excludeDocId: z.string().optional().describe('排除的文档 ID'),
    limit: z.number().optional().default(5).describe('返回数量'),
  }),
  offlineSupport: false,
  execute: async ({ content, excludeDocId, limit }) => {
    // 使用语义搜索找到相关笔记
    const searchResult = await semanticSearch.execute(
      { query: content, topK: limit * 2, threshold: 0.3 },
      {} as any
    )

    if (!searchResult.success) {
      return {
        success: false as const,
        error: searchResult.error || 'Search failed',
      }
    }

    // 过滤排除的文档
    const results = searchResult.data?.results || []
    const filtered = excludeDocId
      ? results.filter(r => r.documentId !== excludeDocId)
      : results

    return {
      success: true as const,
      data: {
        relatedNotes: filtered.slice(0, limit),
        total: filtered.length,
      },
    }
  },
  examples: [{
    description: '找到与当前段落相关的笔记',
    input: { content: '向量数据库的选型...', limit: 3 },
    output: { success: true, data: { relatedNotes: [], total: 0 } },
  }],
})

/**
 * 构建知识上下文
 */
export const buildKnowledgeContext = defineTool({
  name: 'buildKnowledgeContext',
  description: '为 AI 对话构建知识库上下文',
  category: 'knowledge',
  inputSchema: z.object({
    query: z.string().describe('用户问题'),
    maxChunks: z.number().optional().default(5).describe('最大块数'),
  }),
  execute: async ({ query, maxChunks }) => {
    const searchResult = await semanticSearch.execute(
      { query, topK: maxChunks, threshold: 0.3 },
      {} as any
    )

    if (!searchResult.success || !searchResult.data?.results.length) {
      return {
        success: true as const,
        data: {
          context: '',
          sources: [] as Array<{ documentId: string; title: string }>,
          hasContext: false,
          chunkCount: 0,
        },
      }
    }

    const results = searchResult.data.results

    // 构建格式化的上下文
    const context = results
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n---\n\n')

    // 去重的来源列表
    const sources = [...new Map(
      results.map(r => [r.documentId, { documentId: r.documentId, title: r.documentTitle }])
    ).values()]

    return {
      success: true as const,
      data: {
        context,
        sources,
        hasContext: true,
        chunkCount: results.length,
      },
    }
  },
})

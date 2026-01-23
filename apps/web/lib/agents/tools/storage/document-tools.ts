/**
 * Document Storage Tools
 *
 * 文档读写工具
 */

import { z } from 'zod'
import { defineTool } from '../types'
import { documentStore } from '@/lib/storage/document-store'

/**
 * 读取文档
 */
export const readDocument = defineTool({
  name: 'readDocument',
  description: '读取指定文档的完整内容',
  category: 'storage',
  inputSchema: z.object({
    documentId: z.string().describe('文档 ID'),
  }),
  offlineSupport: true,
  execute: async ({ documentId }) => {
    try {
      const doc = await documentStore.getDocument(documentId)
      if (!doc) {
        return { success: false, error: 'Document not found' }
      }

      return {
        success: true,
        data: {
          id: doc.id,
          title: doc.title,
          content: doc.plainText,
          updatedAt: doc.updatedAt,
          isDirty: doc.isDirty,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read document',
      }
    }
  },
  examples: [{
    description: '读取文档内容',
    input: { documentId: 'doc-123' },
    output: { success: true, data: { id: 'doc-123', title: 'My Note', content: '...' } },
  }],
})

/**
 * 列出所有文档
 */
export const listDocuments = defineTool({
  name: 'listDocuments',
  description: '列出所有文档（按更新时间排序）',
  category: 'storage',
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe('返回数量限制'),
    includeDeleted: z.boolean().optional().default(false).describe('是否包含已删除'),
  }),
  offlineSupport: true,
  execute: async ({ limit, includeDeleted }) => {
    try {
      const docs = await documentStore.getAllDocuments()

      const filtered = includeDeleted
        ? docs
        : docs.filter(d => !d.isDeleted)

      const sorted = filtered.sort((a, b) => b.updatedAt - a.updatedAt)

      return {
        success: true,
        data: {
          documents: sorted.slice(0, limit).map(d => ({
            id: d.id,
            title: d.title,
            updatedAt: d.updatedAt,
            isDirty: d.isDirty,
          })),
          total: filtered.length,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list documents',
      }
    }
  },
})

/**
 * 本地搜索文档
 */
export const searchDocumentsLocal = defineTool({
  name: 'searchDocumentsLocal',
  description: '在本地搜索文档（标题和内容，离线可用）',
  category: 'storage',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词'),
    limit: z.number().optional().default(10).describe('返回数量'),
  }),
  offlineSupport: true,
  execute: async ({ query, limit }) => {
    try {
      const results = await documentStore.searchDocuments(query)

      return {
        success: true,
        data: {
          results: results.slice(0, limit).map(d => ({
            id: d.id,
            title: d.title,
            snippet: d.plainText.slice(0, 200) + (d.plainText.length > 200 ? '...' : ''),
            updatedAt: d.updatedAt,
          })),
          total: results.length,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }
    }
  },
  examples: [{
    description: '搜索包含 RAG 的文档',
    input: { query: 'RAG', limit: 5 },
    output: { success: true, data: { results: [], total: 0 } },
  }],
})

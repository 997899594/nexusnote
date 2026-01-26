/**
 * Knowledge Agent
 *
 * 知识管理 Agent，专注于：
 * - RAG 语义搜索
 * - 笔记关联发现
 * - 知识整理和总结
 */

import { BaseAgent } from '../core/base-agent'
import type { AgentType, AgentContext } from '../core/types'

export class KnowledgeAgent extends BaseAgent {
  readonly type: AgentType = 'knowledge'
  readonly name = 'Knowledge Agent'
  readonly description = '智能知识管理助手，帮助搜索、关联和整理笔记'
  readonly defaultTools = [
    'semanticSearch',
    'findRelatedNotes',
    'readDocument',
    'listDocuments',
    'searchDocumentsLocal',
    'createFlashcards',
    'createLearningPlan',
  ]

  constructor(context?: Partial<AgentContext>) {
    super(context)
    this.initialize()
  }
}

export function createKnowledgeAgent() {
  return new KnowledgeAgent()
}

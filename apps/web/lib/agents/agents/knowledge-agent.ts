/**
 * Knowledge Agent
 *
 * 知识管理 Agent，专注于：
 * - RAG 语义搜索
 * - 笔记关联发现
 * - 知识整理和总结
 */

import { BaseAgent } from '../core/base-agent'
import type { AgentType, AgentInput, AgentContext } from '../core/types'

export class KnowledgeAgent extends BaseAgent {
  readonly type: AgentType = 'knowledge'
  readonly name = 'Knowledge Agent'
  readonly description = '智能知识管理助手，帮助搜索、关联和整理笔记'
  readonly defaultTools = [
    'semanticSearch',
    'findRelatedNotes',
    'buildKnowledgeContext',
    'readDocument',
    'listDocuments',
    'searchDocumentsLocal',
    'applyEdit',
    'getDocumentStructure',
  ]

  constructor(context?: Partial<AgentContext>) {
    super(context)
    this.initialize()
  }

  protected async observe(input: AgentInput): Promise<string> {
    const base = await super.observe(input)

    // Knowledge Agent 特定的观察
    const parts = [base]

    if (input.goal.includes('搜索') || input.goal.includes('查找')) {
      parts.push('任务类型: 知识检索')
    } else if (input.goal.includes('整理') || input.goal.includes('总结')) {
      parts.push('任务类型: 知识整理')
    } else if (input.goal.includes('关联') || input.goal.includes('相关')) {
      parts.push('任务类型: 关联发现')
    }

    return parts.join('\n')
  }
}

export function createKnowledgeAgent() {
  return new KnowledgeAgent()
}

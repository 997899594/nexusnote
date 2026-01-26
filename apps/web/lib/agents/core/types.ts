/**
 * Agent Core Types
 *
 * 统一 Agent 系统的核心类型定义
 */

import type { DocumentStructure, EditCommand } from '@nexusnote/types'

// ============================================
// Agent 状态定义
// ============================================

export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'reflecting'
  | 'paused'
  | 'completed'
  | 'failed'

export type StepType = 'plan' | 'execute' | 'ask_user'

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_user'

/**
 * Agent 执行步骤
 */
export interface AgentStep {
  id: string
  type: StepType
  status: StepStatus
  tool?: string
  input?: Record<string, unknown>
  output?: unknown
  error?: string
  thought?: string  // Agent 的思考过程（透明执行）
  question?: string  // 需要用户回答的问题（type='ask_user' 时使用）
  userResponse?: string  // 用户的回答
  startedAt?: number
  completedAt?: number
}

/**
 * Agent 执行计划
 */
export interface AgentPlan {
  id: string
  goal: string
  steps: AgentStep[]
  currentStepIndex: number
  createdAt: number
  updatedAt: number
}

/**
 * Agent 执行状态
 */
export interface AgentState {
  id: string
  agentType: string
  status: AgentStatus
  plan: AgentPlan | null
  history: AgentStep[]
  context: AgentContext
  error?: string
  startedAt: number
  completedAt?: number
}

// ============================================
// Agent Context - 执行上下文
// ============================================

/**
 * 文档上下文（来自 EditorContext）
 */
export interface DocumentContext {
  id: string
  title: string
  content: string
  structure: DocumentStructure
}

/**
 * Agent 记忆系统
 */
export interface AgentMemory {
  /** 短期记忆（会话内） */
  shortTerm: Map<string, unknown>
  /** 工作笔记 ID 列表 */
  workingNotes: string[]
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** 最大澄清轮数 */
  maxClarificationRounds: number
  /** AI 温度参数 */
  temperature: number
}

/**
 * Agent 执行上下文
 */
export interface AgentContext {
  /** 会话 ID */
  sessionId: string
  /** 用户 ID（可选） */
  userId?: string
  /** 文档上下文（可选，来自 EditorContext） */
  document?: DocumentContext
  /** 记忆系统 */
  memory: AgentMemory
  /** 可用工具列表 */
  availableTools: string[]
  /** 配置 */
  config: AgentConfig
}

// ============================================
// Agent 输入/输出
// ============================================

/**
 * Agent 输入
 */
export interface AgentInput {
  /** 用户目标 */
  goal: string
  /** 额外上下文 */
  context?: Partial<AgentContext>
  /** 约束条件 */
  constraints?: string[]
  /** 首选工具 */
  preferredTools?: string[]
}

/**
 * Agent 产物
 */
export interface AgentArtifact {
  type: 'document' | 'flashcards' | 'learningPlan' | 'summary' | 'edit' | 'search_results'
  id: string
  data: unknown
  createdAt: number
}

/**
 * Agent 输出
 */
export interface AgentOutput {
  success: boolean
  result?: unknown
  summary: string
  artifacts: AgentArtifact[]
  steps: AgentStep[]
  /** 待确认的编辑（用户选择：可配置） */
  pendingEdits?: EditCommand[]
}

// ============================================
// Agent 事件（透明执行）
// ============================================

export type AgentEvent =
  | { type: 'started'; agentId: string; goal: string }
  | { type: 'planning'; agentId: string; thought: string }
  | { type: 'planCreated'; agentId: string; plan: AgentPlan }
  | { type: 'stepStarted'; agentId: string; step: AgentStep }
  | { type: 'stepCompleted'; agentId: string; step: AgentStep }
  | { type: 'toolCalled'; agentId: string; tool: string; input: unknown }
  | { type: 'toolResult'; agentId: string; tool: string; output: unknown; error?: string }
  | { type: 'reflecting'; agentId: string; reflection: string }
  | { type: 'planAdjusted'; agentId: string; reason: string }
  | { type: 'completed'; agentId: string; output: AgentOutput }
  | { type: 'failed'; agentId: string; error: string }
  | { type: 'paused'; agentId: string; reason: string }
  | { type: 'resumed'; agentId: string }

export type AgentEventHandler = (event: AgentEvent) => void

// ============================================
// Agent 类型定义
// ============================================

export type AgentType = 'knowledge' | 'research' | 'learning'

export interface AgentDefinition {
  type: AgentType
  name: string
  description: string
  defaultTools: string[]
  icon?: string
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxClarificationRounds: 2,
  temperature: 0.7,
}

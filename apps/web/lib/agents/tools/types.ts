/**
 * Agent Tool Types
 *
 * 统一工具定义类型
 */

import { z } from 'zod'
import type { AgentContext } from '../core/types'

// ============================================
// Tool 类型定义
// ============================================

export type ToolCategory = 'storage' | 'editor' | 'knowledge' | 'ai' | 'system'

/**
 * 工具执行结果
 */
export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  /** 是否需要用户确认 */
  requiresConfirmation?: boolean
  /** 待确认的数据 */
  pendingData?: unknown
}

/**
 * 工具使用示例
 */
export interface ToolExample {
  description: string
  input: Record<string, unknown>
  output: unknown
}

/**
 * Agent 工具定义
 */
export interface AgentTool<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown
> {
  /** 工具名称（唯一标识） */
  name: string
  /** 工具描述（用于 AI 理解） */
  description: string
  /** 工具分类 */
  category: ToolCategory
  /** 输入 Schema（Zod） */
  inputSchema: z.ZodSchema<TInput>
  /** 执行函数 */
  execute: (input: TInput, context: AgentContext) => Promise<ToolResult<TOutput>>
  /** 使用示例 */
  examples?: ToolExample[]
  /** 是否需要用户确认 */
  requiresConfirmation?: boolean
  /** 是否有副作用 */
  sideEffects?: boolean
  /** 是否可在离线模式使用 */
  offlineSupport?: boolean
}

// ============================================
// Tool 定义助手
// ============================================

/**
 * 定义工具的类型安全助手
 */
export function defineTool<
  TInput extends Record<string, unknown>,
  TOutput
>(config: AgentTool<TInput, TOutput>): AgentTool<TInput, TOutput> {
  return config
}

// ============================================
// Tool Registry 类型
// ============================================

export interface ToolRegistryOptions {
  /** 是否在注册时验证 Schema */
  validateOnRegister?: boolean
  /** 是否允许覆盖已注册的工具 */
  allowOverride?: boolean
}

export interface RegisteredTool {
  tool: AgentTool<any, any>
  registeredAt: number
}

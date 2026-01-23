/**
 * Tool Registry
 *
 * 统一工具注册管理
 * 所有 Agent 共享同一个 Registry
 */

import { tool } from 'ai'
import type { AgentTool, ToolCategory, RegisteredTool, ToolRegistryOptions } from './types'

class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()
  private categories = new Map<ToolCategory, Set<string>>()
  private options: ToolRegistryOptions

  constructor(options: ToolRegistryOptions = {}) {
    this.options = {
      validateOnRegister: true,
      allowOverride: true,
      ...options,
    }
  }

  /**
   * 注册工具
   */
  register<T extends Record<string, unknown>, O>(agentTool: AgentTool<T, O>): void {
    const { name, category } = agentTool

    if (this.tools.has(name) && !this.options.allowOverride) {
      throw new Error(`[ToolRegistry] Tool "${name}" already registered`)
    }

    if (this.tools.has(name)) {
      console.warn(`[ToolRegistry] Overriding tool: ${name}`)
    }

    this.tools.set(name, {
      tool: agentTool,
      registeredAt: Date.now(),
    })

    // 按类别索引
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set())
    }
    this.categories.get(category)!.add(name)

    console.log(`[ToolRegistry] Registered: ${name} (${category})`)
  }

  /**
   * 批量注册工具
   */
  registerMany(tools: AgentTool<any, any>[]): void {
    tools.forEach(t => this.register(t))
  }

  /**
   * 获取工具
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name)?.tool
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 获取指定类别的所有工具
   */
  getByCategory(category: ToolCategory): AgentTool[] {
    const names = this.categories.get(category) || new Set()
    return Array.from(names)
      .map(name => this.tools.get(name)?.tool)
      .filter((t): t is AgentTool => t !== undefined)
  }

  /**
   * 获取所有工具
   */
  getAll(): AgentTool[] {
    return Array.from(this.tools.values()).map(r => r.tool)
  }

  /**
   * 获取所有工具名称
   */
  getAllNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * 获取工具数量
   */
  size(): number {
    return this.tools.size
  }

  /**
   * 移除工具
   */
  unregister(name: string): boolean {
    const registered = this.tools.get(name)
    if (!registered) return false

    this.tools.delete(name)
    this.categories.get(registered.tool.category)?.delete(name)

    console.log(`[ToolRegistry] Unregistered: ${name}`)
    return true
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear()
    this.categories.clear()
    console.log('[ToolRegistry] Cleared all tools')
  }

  /**
   * 转换为 AI SDK tool 格式
   * 用于与 Vercel AI SDK 集成
   * AI SDK 6.x 使用 inputSchema 而不是 parameters
   */
  toAISDKTools(names?: string[]): Record<string, any> {
    const result: Record<string, any> = {}
    const toolNames = names || this.getAllNames()

    for (const name of toolNames) {
      const agentTool = this.get(name)
      if (!agentTool) continue

      result[name] = tool({
        description: agentTool.description,
        inputSchema: agentTool.inputSchema,
        execute: async (input: any) => {
          // 注意：AI SDK 执行时没有完整 context
          // 需要外部传入或使用默认 context
          const toolResult = await agentTool.execute(input, {} as any)
          return toolResult.success ? toolResult.data : { error: toolResult.error }
        },
      })
    }

    return result
  }

  /**
   * 获取工具描述（用于 System Prompt）
   */
  getDescriptions(names?: string[]): string {
    const toolNames = names || this.getAllNames()

    return toolNames
      .map(name => {
        const agentTool = this.get(name)
        if (!agentTool) return null

        const examples = agentTool.examples?.length
          ? `\n  示例: ${JSON.stringify(agentTool.examples[0].input)}`
          : ''

        return `- **${name}** (${agentTool.category}): ${agentTool.description}${examples}`
      })
      .filter(Boolean)
      .join('\n')
  }

  /**
   * 获取工具的 JSON Schema（用于调试）
   */
  getSchemas(names?: string[]): Record<string, unknown> {
    const toolNames = names || this.getAllNames()
    const result: Record<string, unknown> = {}

    for (const name of toolNames) {
      const agentTool = this.get(name)
      if (!agentTool) continue

      // Zod schema 转 JSON Schema（简化版）
      result[name] = {
        name,
        description: agentTool.description,
        category: agentTool.category,
        requiresConfirmation: agentTool.requiresConfirmation,
        sideEffects: agentTool.sideEffects,
      }
    }

    return result
  }
}

// 单例导出
export const toolRegistry = new ToolRegistry()

// 类型导出
export { ToolRegistry }

/**
 * Base Agent
 *
 * Agent 基类，封装 OPER 循环（Observe → Plan → Execute → Reflect）
 * 所有具体 Agent 继承此类
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { v4 as uuid } from 'uuid'
import { toolRegistry } from '../tools/tool-registry'
import { config } from '@/lib/config'
import type {
  AgentStatus,
  AgentStep,
  AgentPlan,
  AgentState,
  AgentContext,
  AgentInput,
  AgentOutput,
  AgentEvent,
  AgentEventHandler,
  AgentConfig,
  AgentType,
  AgentArtifact,
  DEFAULT_AGENT_CONFIG,
} from './types'

// ============================================
// 创建 OpenAI Provider
// ============================================

function createProvider() {
  return createOpenAI({
    baseURL: config.ai.baseUrl,
    apiKey: config.ai.apiKey,
  })
}

// ============================================
// Agent 基类
// ============================================

export abstract class BaseAgent {
  // 抽象属性 - 子类必须实现
  abstract readonly type: AgentType
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly defaultTools: string[]

  // 内部状态
  protected state!: AgentState
  protected eventHandlers: Set<AgentEventHandler> = new Set()
  protected abortController: AbortController | null = null
  private _context: Partial<AgentContext>

  constructor(context: Partial<AgentContext> = {}) {
    this._context = context
  }

  /**
   * 初始化状态 - 子类必须在构造函数末尾调用
   */
  protected initialize(): void {
    const agentId = uuid()

    this.state = {
      id: agentId,
      agentType: this.type,
      status: 'idle',
      plan: null,
      history: [],
      context: this.buildContext(this._context),
      startedAt: Date.now(),
    }
  }

  // ============================================
  // 核心 Agent Loop
  // ============================================

  /**
   * 运行 Agent（主入口）
   */
  async run(input: AgentInput): Promise<AgentOutput> {
    const { goal, constraints, preferredTools } = input

    try {
      // 初始化
      this.state.status = 'planning'
      this.abortController = new AbortController()
      this.emit({ type: 'started', agentId: this.state.id, goal })

      // 1. Observe - 观察当前状态
      const observation = await this.observe(input)

      // 2. Plan - 制定执行计划
      const plan = await this.plan(goal, observation, constraints)
      this.state.plan = plan
      this.emit({ type: 'planCreated', agentId: this.state.id, plan })

      // 3. Execute - 执行计划中的每个步骤
      this.state.status = 'executing'
      let iteration = 0
      const maxIterations = this.state.context.config.maxIterations

      while (this.hasMoreSteps() && iteration < maxIterations) {
        // 检查是否被中断
        if (this.abortController.signal.aborted) {
          throw new Error('Agent execution aborted')
        }

        // 检查是否暂停（pause() 可能从外部调用改变状态）
        // 使用类型断言因为 pause() 可以异步改变状态
        if ((this.state.status as AgentStatus) === 'paused') {
          await this.waitForResume()
        }

        const currentStep = this.getCurrentStep()
        if (!currentStep) break

        // 执行当前步骤
        await this.executeStep(currentStep)

        // 4. Reflect - 反思并可能调整计划
        if (this.state.context.config.enableReflection && this.shouldReflect()) {
          this.state.status = 'reflecting'
          await this.reflect()
          this.state.status = 'executing'
        }

        iteration++
      }

      // 5. Synthesize - 综合结果
      const output = await this.synthesize()
      this.state.status = 'completed'
      this.state.completedAt = Date.now()
      this.emit({ type: 'completed', agentId: this.state.id, output })

      return output

    } catch (error) {
      this.state.status = 'failed'
      this.state.error = error instanceof Error ? error.message : 'Unknown error'
      this.emit({ type: 'failed', agentId: this.state.id, error: this.state.error })

      return {
        success: false,
        summary: `执行失败: ${this.state.error}`,
        artifacts: [],
        steps: this.state.history,
      }
    }
  }

  // ============================================
  // OPER 各阶段实现
  // ============================================

  /**
   * Observe - 观察当前状态
   * 子类可以覆盖以添加特定观察逻辑
   */
  protected async observe(input: AgentInput): Promise<string> {
    const parts: string[] = []

    // 文档上下文
    if (this.state.context.document) {
      const doc = this.state.context.document
      parts.push(`当前文档: "${doc.title}"`)
      parts.push(`文档结构: ${doc.structure.totalBlocks} 个块`)
    }

    // 可用工具
    const tools = this.getAvailableTools()
    parts.push(`可用工具: ${tools.join(', ')}`)

    // 用户约束
    if (input.constraints?.length) {
      parts.push(`约束条件: ${input.constraints.join('; ')}`)
    }

    return parts.join('\n')
  }

  /**
   * Plan - 制定执行计划
   */
  protected async plan(
    goal: string,
    observation: string,
    constraints?: string[]
  ): Promise<AgentPlan> {
    this.emit({ type: 'planning', agentId: this.state.id, thought: '分析目标，制定计划...' })

    const provider = createProvider()
    const tools = this.getAvailableTools()

    const systemPrompt = this.buildPlanningPrompt(tools)
    const userPrompt = `
目标: ${goal}

当前状态:
${observation}

${constraints?.length ? `约束条件:\n${constraints.join('\n')}` : ''}

请制定一个清晰的执行计划，列出需要执行的步骤。
每个步骤应该包含：
1. 步骤描述
2. 需要使用的工具（如果有）
3. 工具参数

以 JSON 格式返回：
{
  "steps": [
    { "thought": "步骤描述", "tool": "工具名", "input": { ... } }
  ]
}
`

    const { text } = await generateText({
      model: provider(config.ai.model),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: this.state.context.config.temperature,
    })

    // 解析计划
    const steps = this.parsePlanResponse(text)

    return {
      id: uuid(),
      goal,
      steps,
      currentStepIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  /**
   * Execute Step - 执行单个步骤
   */
  protected async executeStep(step: AgentStep): Promise<void> {
    step.status = 'running'
    step.startedAt = Date.now()
    this.emit({ type: 'stepStarted', agentId: this.state.id, step })

    try {
      if (step.tool) {
        // 调用工具
        this.emit({
          type: 'toolCalled',
          agentId: this.state.id,
          tool: step.tool,
          input: step.input,
        })

        const tool = toolRegistry.get(step.tool)
        if (!tool) {
          throw new Error(`Tool not found: ${step.tool}`)
        }

        const result = await tool.execute(step.input as any, this.state.context)

        step.output = result
        this.emit({
          type: 'toolResult',
          agentId: this.state.id,
          tool: step.tool,
          output: result,
          error: result.success ? undefined : result.error,
        })

        if (!result.success) {
          step.status = 'failed'
          step.error = result.error
        } else {
          step.status = 'completed'
        }
      } else {
        // 纯思考步骤
        step.status = 'completed'
      }
    } catch (error) {
      step.status = 'failed'
      step.error = error instanceof Error ? error.message : 'Step execution failed'
    }

    step.completedAt = Date.now()
    this.state.history.push(step)

    // 移动到下一步
    if (this.state.plan) {
      this.state.plan.currentStepIndex++
      this.state.plan.updatedAt = Date.now()
    }

    this.emit({ type: 'stepCompleted', agentId: this.state.id, step })
  }

  /**
   * Reflect - 反思执行结果
   */
  protected async reflect(): Promise<void> {
    const recentSteps = this.state.history.slice(-3)
    const failedSteps = recentSteps.filter(s => s.status === 'failed')

    if (failedSteps.length === 0) return

    this.emit({
      type: 'reflecting',
      agentId: this.state.id,
      reflection: `检测到 ${failedSteps.length} 个失败步骤，正在调整计划...`,
    })

    const provider = createProvider()

    const { text } = await generateText({
      model: provider(config.ai.model),
      system: '你是一个反思助手，帮助分析失败原因并调整计划。',
      prompt: `
最近执行的步骤:
${recentSteps.map(s => `- ${s.thought || s.tool}: ${s.status} ${s.error ? `(错误: ${s.error})` : ''}`).join('\n')}

剩余计划:
${this.getRemainingSteps().map(s => `- ${s.thought || s.tool}`).join('\n')}

请分析失败原因，并建议是否需要调整计划。
返回 JSON: { "shouldAdjust": boolean, "reason": "原因", "newSteps": [...] }
`,
      temperature: 0.3,
    })

    try {
      const reflection = JSON.parse(text)
      if (reflection.shouldAdjust && reflection.newSteps && this.state.plan) {
        // 调整剩余计划
        const currentIndex = this.state.plan.currentStepIndex
        const newSteps = reflection.newSteps.map((s: any) => this.createStep(s))
        this.state.plan.steps = [
          ...this.state.plan.steps.slice(0, currentIndex),
          ...newSteps,
        ]
        this.emit({
          type: 'planAdjusted',
          agentId: this.state.id,
          reason: reflection.reason,
        })
      }
    } catch {
      // 解析失败，继续原计划
    }
  }

  /**
   * Synthesize - 综合最终结果
   */
  protected async synthesize(): Promise<AgentOutput> {
    const artifacts = this.collectArtifacts()
    const pendingEdits = this.collectPendingEdits()

    // 生成总结
    const provider = createProvider()
    const { text: summary } = await generateText({
      model: provider(config.ai.model),
      system: '简洁地总结 Agent 的执行结果，用中文回复。',
      prompt: `
执行目标: ${this.state.plan?.goal}

执行步骤:
${this.state.history.map(s => `- ${s.thought || s.tool}: ${s.status}`).join('\n')}

产物数量: ${artifacts.length}
待确认编辑: ${pendingEdits.length}

请用 1-2 句话总结执行结果。
`,
      temperature: 0.3,
    })

    return {
      success: this.state.status !== 'failed',
      summary,
      artifacts,
      steps: this.state.history,
      pendingEdits: pendingEdits.length > 0 ? pendingEdits : undefined,
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  protected buildContext(partial: Partial<AgentContext>): AgentContext {
    return {
      sessionId: uuid(),
      memory: {
        shortTerm: new Map(),
        workingNotes: [],
      },
      availableTools: this.defaultTools,
      config: {
        maxSteps: 20,
        maxIterations: 10,
        temperature: 0.7,
        enableReflection: true,
        autoApplyEdits: false,
        timeout: 60000,
      },
      ...partial,
    }
  }

  protected buildPlanningPrompt(tools: string[]): string {
    const toolDescriptions = toolRegistry.getDescriptions(tools)

    return `你是一个智能 Agent，负责帮助用户完成知识管理任务。

可用工具:
${toolDescriptions}

规则:
1. 分析用户目标，制定清晰的执行计划
2. 每个步骤应该明确、可执行
3. 优先使用已有工具，避免不必要的步骤
4. 考虑步骤之间的依赖关系
`
  }

  protected parsePlanResponse(text: string): AgentStep[] {
    try {
      // 尝试从 markdown 代码块中提取 JSON
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : text

      const parsed = JSON.parse(jsonStr.trim())
      const steps = parsed.steps || parsed

      return steps.map((s: any) => this.createStep(s))
    } catch {
      // 解析失败，创建单步计划
      return [this.createStep({ thought: '执行用户请求' })]
    }
  }

  protected createStep(data: Partial<AgentStep>): AgentStep {
    return {
      id: uuid(),
      type: data.tool ? 'execute' : 'plan',
      status: 'pending',
      tool: data.tool,
      input: data.input,
      thought: data.thought,
    }
  }

  protected getAvailableTools(): string[] {
    return this.state.context.availableTools.filter(name => toolRegistry.has(name))
  }

  protected hasMoreSteps(): boolean {
    if (!this.state.plan) return false
    return this.state.plan.currentStepIndex < this.state.plan.steps.length
  }

  protected getCurrentStep(): AgentStep | null {
    if (!this.state.plan) return null
    return this.state.plan.steps[this.state.plan.currentStepIndex] || null
  }

  protected getRemainingSteps(): AgentStep[] {
    if (!this.state.plan) return []
    return this.state.plan.steps.slice(this.state.plan.currentStepIndex)
  }

  protected shouldReflect(): boolean {
    // 每 3 步反思一次，或遇到失败时反思
    const recentSteps = this.state.history.slice(-3)
    const hasFailed = recentSteps.some(s => s.status === 'failed')
    return hasFailed || this.state.history.length % 3 === 0
  }

  protected collectArtifacts(): AgentArtifact[] {
    const artifacts: AgentArtifact[] = []

    for (const step of this.state.history) {
      if (step.status !== 'completed' || !step.output) continue

      const output = step.output as any
      if (output.success && output.data) {
        artifacts.push({
          type: this.inferArtifactType(step.tool),
          id: uuid(),
          data: output.data,
          createdAt: step.completedAt || Date.now(),
        })
      }
    }

    return artifacts
  }

  protected inferArtifactType(tool?: string): AgentArtifact['type'] {
    if (!tool) return 'summary'
    if (tool.includes('search') || tool.includes('Search')) return 'search_results'
    if (tool.includes('edit') || tool.includes('Edit')) return 'edit'
    if (tool.includes('flashcard')) return 'flashcards'
    if (tool.includes('plan') || tool.includes('Plan')) return 'learningPlan'
    return 'summary'
  }

  protected collectPendingEdits(): import('@nexusnote/types').EditCommand[] {
    const edits: import('@nexusnote/types').EditCommand[] = []

    for (const step of this.state.history) {
      const output = step.output as any
      if (output?.pendingData && output?.requiresConfirmation) {
        if (Array.isArray(output.pendingData)) {
          edits.push(...output.pendingData)
        } else {
          edits.push(output.pendingData)
        }
      }
    }

    return edits
  }

  protected async waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.state.status !== 'paused') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  // ============================================
  // 事件系统
  // ============================================

  protected emit(event: AgentEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event)
      } catch (error) {
        console.error('[BaseAgent] Event handler error:', error)
      }
    })
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 订阅事件
   */
  on(handler: AgentEventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  /**
   * 暂停执行
   */
  pause(reason = 'User requested'): void {
    if (this.state.status === 'executing') {
      this.state.status = 'paused'
      this.emit({ type: 'paused', agentId: this.state.id, reason })
    }
  }

  /**
   * 恢复执行
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'executing'
      this.emit({ type: 'resumed', agentId: this.state.id })
    }
  }

  /**
   * 中止执行
   */
  abort(): void {
    this.abortController?.abort()
    this.state.status = 'failed'
    this.state.error = 'Aborted by user'
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<AgentState> {
    return this.state
  }

  /**
   * 获取 Agent ID
   */
  getId(): string {
    return this.state.id
  }
}

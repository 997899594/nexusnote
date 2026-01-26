/**
 * Base Agent
 * 
 * 使用 AI Function Calling 自动调用工具完成任务
 */

import { v4 as uuid } from 'uuid'
import { toolRegistry } from '../tools/tool-registry'
import type {
  AgentStep,
  AgentPlan,
  AgentState,
  AgentContext,
  AgentInput,
  AgentOutput,
  AgentEvent,
  AgentEventHandler,
  AgentType,
  AgentArtifact,
} from './types'

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

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      this.state.status = 'planning'
      this.abortController = new AbortController()
      this.emit({ type: 'started', agentId: this.state.id, goal: input.goal })

      // 构建观察信息
      const observation = this.buildObservation(input)

      // AI 自动制定计划并调用工具
      const plan = await this.plan(input.goal, observation, input.constraints)
      this.state.plan = plan
      this.emit({ type: 'planCreated', agentId: this.state.id, plan })

      // 执行步骤（主要处理 ask_user）
      this.state.status = 'executing'
      for (const step of plan.steps) {
        if (this.abortController.signal.aborted) {
          throw new Error('Agent execution aborted')
        }

        await this.executeStep(step)
        
        // 如果需要用户澄清，重新规划
        if (step.type === 'ask_user' && step.userResponse) {
          const newGoal = `${input.goal}\n用户回答: ${step.userResponse}`
          const newPlan = await this.plan(newGoal, observation, input.constraints)
          this.state.plan = newPlan
          this.emit({ type: 'planCreated', agentId: this.state.id, plan: newPlan })
          
          for (const newStep of newPlan.steps) {
            await this.executeStep(newStep)
          }
          break
        }
      }

      // 返回结果
      const output: AgentOutput = {
        success: true,
        summary: this.generateSummary(),
        artifacts: this.collectArtifacts(),
        steps: this.state.history,
      }

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

  protected buildObservation(input: AgentInput): string {
    const parts: string[] = []

    if (this.state.context.document) {
      const doc = this.state.context.document
      parts.push(`当前文档: "${doc.title}"`)
    }

    const tools = this.getAvailableTools()
    parts.push(`可用工具: ${tools.join(', ')}`)

    if (input.constraints?.length) {
      parts.push(`约束: ${input.constraints.join('; ')}`)
    }

    return parts.join('\n')
  }

  /**
   * Plan - AI 自动制定计划并调用工具
   */
  protected async plan(
    goal: string,
    observation: string,
    constraints?: string[]
  ): Promise<AgentPlan> {
    this.emit({ type: 'planning', agentId: this.state.id, thought: '分析目标...' })

    const tools = this.getAvailableTools()
    const clarificationCount = this.state.history.filter(s => s.type === 'ask_user').length
    const maxRounds = this.state.context.config.maxClarificationRounds
    const canAskUser = clarificationCount < maxRounds

    const systemPrompt = `你是智能 Agent，帮助用户完成知识管理任务。

${observation}
${constraints?.length ? `\n约束:\n${constraints.join('\n')}` : ''}

规则:
1. 调用工具完成任务
2. 目标不明确时可澄清（最多 ${maxRounds} 次，已澄清 ${clarificationCount} 次）
${!canAskUser ? '3. ⚠️ 已达澄清上限，必须直接执行' : ''}

可用工具已注册，直接调用即可。`

    const userPrompt = `用户目标: ${goal}

${canAskUser ? '如果目标不明确，先提问澄清。\n' : ''}请调用工具完成任务。`

    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: systemPrompt,
        prompt: userPrompt,
        tools,
        maxSteps: 5,
        temperature: this.state.context.config.temperature,
      }),
    })

    if (!response.ok) {
      throw new Error(`Agent API failed: ${response.status}`)
    }

    const data = await response.json()
    
    // 检查是否需要澄清
    if (canAskUser && this.needsClarification(data.text)) {
      return {
        id: uuid(),
        goal,
        steps: [{
          id: uuid(),
          type: 'ask_user',
          status: 'pending',
          thought: '需要澄清',
          question: this.extractQuestion(data.text),
        }],
        currentStepIndex: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    }

    // 转换工具调用为步骤
    const steps = this.convertToolCallsToSteps(data.toolCalls || [], data.text)

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
   * Execute Step - 执行步骤
   */
  protected async executeStep(step: AgentStep): Promise<void> {
    step.startedAt = Date.now()
    this.emit({ type: 'stepStarted', agentId: this.state.id, step })

    try {
      if (step.type === 'ask_user') {
        step.status = 'waiting_user'
        this.state.status = 'paused'
        this.emit({ 
          type: 'paused', 
          agentId: this.state.id, 
          reason: step.question || '需要用户输入'
        })
        
        await this.waitForResume()
        
        step.output = { userResponse: step.userResponse }
        step.status = 'completed'
        this.state.status = 'executing'
      } else {
        // 工具已被 AI 调用完成
        step.status = 'completed'
      }
    } catch (error) {
      step.status = 'failed'
      step.error = error instanceof Error ? error.message : 'Step failed'
    }

    step.completedAt = Date.now()
    this.state.history.push(step)
    this.emit({ type: 'stepCompleted', agentId: this.state.id, step })
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
        maxClarificationRounds: 2,
        temperature: 0.7,
      },
      ...partial,
    }
  }

  protected needsClarification(text: string): boolean {
    const keywords = ['请问', '能否', '可以告诉我', '需要了解', '具体是', '什么时候', '哪个', '哪些']
    return keywords.some(k => text.includes(k))
  }

  protected extractQuestion(text: string): string {
    const match = text.match(/[^。！？]*[？?][^。！？]*/g)
    return match ? match[0].trim() : text.trim()
  }

  protected convertToolCallsToSteps(
    toolCalls: Array<{ toolName: string; args: any; result: any }>,
    summary: string
  ): AgentStep[] {
    if (!toolCalls || toolCalls.length === 0) {
      return [{
        id: uuid(),
        type: 'plan',
        status: 'completed',
        thought: summary || '分析完成',
        startedAt: Date.now(),
        completedAt: Date.now(),
      }]
    }

    return toolCalls.map(call => ({
      id: uuid(),
      type: 'execute',
      status: 'completed',
      tool: call.toolName,
      input: call.args,
      output: call.result,
      thought: `调用 ${call.toolName}`,
      startedAt: Date.now(),
      completedAt: Date.now(),
    }))
  }

  protected getAvailableTools(): string[] {
    return this.state.context.availableTools.filter(name => toolRegistry.has(name))
  }

  protected generateSummary(): string {
    const completedSteps = this.state.history.filter(s => s.status === 'completed')
    if (completedSteps.length === 0) return '未执行任何操作'
    
    const toolCalls = completedSteps.filter(s => s.tool).map(s => s.tool).join(', ')
    return toolCalls ? `已调用工具: ${toolCalls}` : '执行完成'
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
    if (tool.includes('search')) return 'search_results'
    if (tool.includes('edit')) return 'edit'
    if (tool.includes('flashcard')) return 'flashcards'
    if (tool.includes('Plan')) return 'learningPlan'
    return 'summary'
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

  on(handler: AgentEventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  resume(userInput?: string): void {
    if (this.state.status === 'paused') {
      const waitingStep = this.state.plan?.steps.find(s => s.status === 'waiting_user')
      if (waitingStep && userInput) {
        waitingStep.userResponse = userInput
      }
      this.state.status = 'executing'
      this.emit({ type: 'resumed', agentId: this.state.id })
    }
  }

  abort(): void {
    this.abortController?.abort()
    this.state.status = 'failed'
    this.state.error = 'Aborted by user'
  }

  getState(): Readonly<AgentState> {
    return this.state
  }

  getId(): string {
    return this.state.id
  }
}

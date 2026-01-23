/**
 * Agent Runtime
 *
 * Agent 运行时单例，管理所有 Agent 实例
 */

import type { BaseAgent } from './base-agent'
import type { AgentEvent, AgentEventHandler, AgentState, AgentInput, AgentOutput } from './types'

class AgentRuntime {
  private agents = new Map<string, BaseAgent>()
  private activeId: string | null = null
  private handlers = new Set<AgentEventHandler>()

  register(agent: BaseAgent): string {
    const id = agent.getId()
    this.agents.set(id, agent)
    agent.on(e => this.handlers.forEach(h => h(e)))
    return id
  }

  async run(agent: BaseAgent, input: AgentInput): Promise<AgentOutput> {
    this.register(agent)
    this.activeId = agent.getId()
    try {
      return await agent.run(input)
    } finally {
      this.activeId = null
    }
  }

  get(id: string) { return this.agents.get(id) }
  getActive() { return this.activeId ? this.agents.get(this.activeId) : null }
  getAllStates(): AgentState[] { return [...this.agents.values()].map(a => a.getState()) }

  pauseActive(reason?: string) { this.getActive()?.pause(reason) }
  resumeActive() { this.getActive()?.resume() }
  abortActive() { this.getActive()?.abort() }

  remove(id: string) {
    if (this.activeId === id) { this.agents.get(id)?.abort(); this.activeId = null }
    return this.agents.delete(id)
  }

  onGlobal(handler: AgentEventHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  getStats() {
    let completed = 0, failed = 0
    for (const a of this.agents.values()) {
      const s = a.getState().status
      if (s === 'completed') completed++
      if (s === 'failed') failed++
    }
    return { total: this.agents.size, active: this.activeId ? 1 : 0, completed, failed }
  }
}

export const agentRuntime = new AgentRuntime()

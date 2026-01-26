/**
 * useAgent Hook
 *
 * React Hook for Agent integration
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { agentRuntime } from '../core/agent-runtime'
import { createKnowledgeAgent } from '../agents/knowledge-agent'
import type { AgentEvent, AgentInput, AgentOutput, AgentState, AgentType } from '../core/types'

interface UseAgentOptions {
  type?: AgentType
  onEvent?: (event: AgentEvent) => void
}

interface UseAgentReturn {
  state: AgentState | null
  events: AgentEvent[]
  isRunning: boolean
  run: (input: AgentInput) => Promise<AgentOutput>
  resume: (userInput?: string) => void
  abort: () => void
}

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const { type = 'knowledge', onEvent } = options

  const [state, setState] = useState<AgentState | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const agentRef = useRef<ReturnType<typeof createKnowledgeAgent> | null>(null)

  // 事件处理
  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents(prev => [...prev, event])
    onEvent?.(event)

    // 更新状态
    if (agentRef.current) {
      setState(agentRef.current.getState())
    }
  }, [onEvent])

  // 运行 Agent
  const run = useCallback(async (input: AgentInput): Promise<AgentOutput> => {
    setEvents([])
    setIsRunning(true)

    // 创建 Agent
    const agent = type === 'knowledge' ? createKnowledgeAgent() : createKnowledgeAgent()
    agentRef.current = agent

    // 订阅事件
    agent.on(handleEvent)
    setState(agent.getState())

    try {
      const output = await agentRuntime.run(agent, input)
      setState(agent.getState())
      return output
    } finally {
      setIsRunning(false)
    }
  }, [type, handleEvent])

  // 控制方法
  const resume = useCallback((userInput?: string) => agentRef.current?.resume(userInput), [])
  const abort = useCallback(() => { agentRef.current?.abort(); setIsRunning(false) }, [])

  return { state, events, isRunning, run, resume, abort }
}

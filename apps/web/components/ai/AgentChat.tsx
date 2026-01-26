'use client'

import { useState, useCallback, FormEvent, useEffect } from 'react'
import { Send, Bot, Sparkles, Loader2, User } from 'lucide-react'
import { useAgent } from '@/lib/agents/hooks/use-agent'
import { AgentPanel } from './AgentPanel'
import type { AgentOutput, AgentType, AgentEvent } from '@/lib/agents/core/types'

interface AgentChatProps {
  agentType?: AgentType
  onResult?: (output: AgentOutput) => void
  documentContext?: {
    id: string
    title: string
    content: string
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

export function AgentChat({
  agentType = 'knowledge',
  onResult,
  documentContext,
}: AgentChatProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [lastOutput, setLastOutput] = useState<AgentOutput | null>(null)
  const [isWaitingForUser, setIsWaitingForUser] = useState(false)

  const {
    state,
    events,
    isRunning,
    run,
    pause,
    resume,
    abort,
  } = useAgent({
    type: agentType,
    onEvent: (event: AgentEvent) => {
      console.log('[AgentChat] Event:', event.type)
      
      // 监听暂停事件，显示 Agent 的问题
      if (event.type === 'paused') {
        const currentStep = state?.plan?.steps[state.plan.currentStepIndex]
        if (currentStep?.type === 'ask_user' && currentStep.question) {
          setMessages(prev => [...prev, {
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: currentStep.question,
            timestamp: Date.now(),
          }])
          setIsWaitingForUser(true)
        }
      }
      
      // 监听恢复事件
      if (event.type === 'resumed') {
        setIsWaitingForUser(false)
      }
    },
  })

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')

    // 如果正在等待用户回复，则恢复 Agent 执行
    if (isWaitingForUser) {
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      }])
      resume(userMessage)
      return
    }

    // 否则，启动新的 Agent 任务
    if (isRunning) return

    setMessages([{
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }])
    setLastOutput(null)

    const output = await run({
      goal: userMessage,
      context: documentContext ? {
        document: {
          id: documentContext.id,
          title: documentContext.title,
          content: documentContext.content,
          structure: {
            totalBlocks: 0,
            headings: [],
            paragraphs: [],
            blocks: [],
          },
        },
      } : undefined,
    })

    setLastOutput(output)
    onResult?.(output)
    
    // 显示最终结果
    if (output.summary) {
      setMessages(prev => [...prev, {
        id: `agent-result-${Date.now()}`,
        role: 'agent',
        content: output.summary,
        timestamp: Date.now(),
      }])
    }
  }, [input, isRunning, isWaitingForUser, run, resume, documentContext, onResult])

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 欢迎消息 */}
        {messages.length === 0 && !state && (
          <div className="text-center text-muted-foreground py-8">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Knowledge Agent</p>
            <p className="text-sm mt-2">
              我可以帮你搜索知识库、关联笔记、整理内容
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>试试：</p>
              <p className="text-primary">"搜索关于 RAG 的笔记"</p>
              <p className="text-primary">"找到与当前内容相关的笔记"</p>
              <p className="text-primary">"整理一下机器学习的知识点"</p>
            </div>
          </div>
        )}

        {/* 聊天消息 */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'agent' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Agent 执行面板（折叠显示） */}
        {(state || events.length > 0) && (
          <div className="mt-4">
            <AgentPanel
              state={state}
              events={events}
              isRunning={isRunning}
              onPause={pause}
              onResume={() => resume()}
              onAbort={abort}
            />
          </div>
        )}

        {/* 执行结果详情 */}
        {lastOutput && !isRunning && lastOutput.artifacts.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-medium">执行产物</span>
            </div>
            <div className="p-4">
              {/* 产物 */}
              <div className="space-y-2">
                {lastOutput.artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="text-xs bg-muted p-2 rounded"
                  >
                    <span className="font-medium">{artifact.type}</span>
                    <pre className="mt-1 overflow-x-auto max-h-24">
                      {JSON.stringify(artifact.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isWaitingForUser 
                ? "输入你的回答..." 
                : "输入任务目标..."
            }
            className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              isWaitingForUser ? 'border-yellow-500 bg-yellow-50' : ''
            }`}
            disabled={isRunning && !isWaitingForUser}
          />
          <button
            type="submit"
            disabled={!input.trim() || (isRunning && !isWaitingForUser)}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isRunning && !isWaitingForUser ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isWaitingForUser 
            ? '⏸️ Agent 正在等待你的回答' 
            : 'Agent 会自动规划和执行任务'}
        </p>
      </form>
    </div>
  )
}

export default AgentChat

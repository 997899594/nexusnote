'use client'

import { useState, useCallback, FormEvent } from 'react'
import { Send, Bot, Sparkles, Loader2 } from 'lucide-react'
import { useAgent } from '@/lib/agents/hooks/use-agent'
import { AgentPanel } from './AgentPanel'
import type { AgentOutput, AgentType } from '@/lib/agents/core/types'

interface AgentChatProps {
  agentType?: AgentType
  onResult?: (output: AgentOutput) => void
  documentContext?: {
    id: string
    title: string
    content: string
  }
}

export function AgentChat({
  agentType = 'knowledge',
  onResult,
  documentContext,
}: AgentChatProps) {
  const [input, setInput] = useState('')
  const [lastOutput, setLastOutput] = useState<AgentOutput | null>(null)

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
    onEvent: (event) => {
      // 可以在这里处理特定事件
      console.log('[AgentChat] Event:', event.type)
    },
  })

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isRunning) return

    const goal = input.trim()
    setInput('')
    setLastOutput(null)

    const output = await run({
      goal,
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
  }, [input, isRunning, run, documentContext, onResult])

  return (
    <div className="flex flex-col h-full">
      {/* Agent Panel */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 欢迎消息 */}
        {!state && events.length === 0 && (
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

        {/* Agent 执行面板 */}
        {(state || events.length > 0) && (
          <AgentPanel
            state={state}
            events={events}
            isRunning={isRunning}
            onPause={pause}
            onResume={resume}
            onAbort={abort}
          />
        )}

        {/* 执行结果 */}
        {lastOutput && !isRunning && (
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-medium">执行结果</span>
              {lastOutput.success ? (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                  成功
                </span>
              ) : (
                <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded">
                  失败
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm">{lastOutput.summary}</p>

              {/* 产物 */}
              {lastOutput.artifacts.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-2">
                    产物 ({lastOutput.artifacts.length})
                  </div>
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
              )}

              {/* 待确认的编辑 */}
              {lastOutput.pendingEdits && lastOutput.pendingEdits.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-2">
                    待确认编辑 ({lastOutput.pendingEdits.length})
                  </div>
                  <div className="space-y-2">
                    {lastOutput.pendingEdits.map((edit, i) => (
                      <div
                        key={i}
                        className="text-xs bg-orange-50 border border-orange-200 p-2 rounded"
                      >
                        <span className="font-medium text-orange-700">
                          {edit.action} → {edit.targetId}
                        </span>
                        {edit.explanation && (
                          <p className="mt-1 text-orange-600">{edit.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            placeholder="输入任务目标..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isRunning}
          />
          <button
            type="submit"
            disabled={!input.trim() || isRunning}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isRunning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Agent 会自动规划和执行任务
        </p>
      </form>
    </div>
  )
}

export default AgentChat

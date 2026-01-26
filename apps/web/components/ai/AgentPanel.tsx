'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Lightbulb,
  Wrench,
  Target,
  RefreshCw,
  Eye,
  Search,
  FileText,
  Edit3,
  Brain,
  Sparkles,
} from 'lucide-react'
import type { AgentEvent, AgentState, AgentStep, AgentPlan } from '@/lib/agents/core/types'

// ============================================
// Types
// ============================================

interface AgentPanelProps {
  state: AgentState | null
  events: AgentEvent[]
  isRunning: boolean
  onPause: () => void
  onResume: (userInput?: string) => void
  onAbort: () => void
}

// ============================================
// Sub-components
// ============================================

/**
 * 步骤状态图标
 */
function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    case 'waiting_user':
      return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
    case 'skipped':
      return <Clock className="w-4 h-4 text-muted-foreground" />
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />
  }
}

/**
 * 工具图标
 */
function ToolIcon({ tool }: { tool?: string }) {
  if (!tool) return <Lightbulb className="w-4 h-4" />

  if (tool.includes('search') || tool.includes('Search')) {
    return <Search className="w-4 h-4" />
  }
  if (tool.includes('read') || tool.includes('Read') || tool.includes('Document')) {
    return <FileText className="w-4 h-4" />
  }
  if (tool.includes('edit') || tool.includes('Edit')) {
    return <Edit3 className="w-4 h-4" />
  }
  if (tool.includes('knowledge') || tool.includes('Knowledge') || tool.includes('rag')) {
    return <Brain className="w-4 h-4" />
  }

  return <Wrench className="w-4 h-4" />
}

/**
 * 单个步骤项
 */
function AgentStepItem({
  step,
  isActive,
  index,
}: {
  step: AgentStep
  isActive: boolean
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(isActive)

  useEffect(() => {
    if (isActive) setIsExpanded(true)
  }, [isActive])

  const duration = step.startedAt && step.completedAt
    ? Math.round((step.completedAt - step.startedAt) / 1000)
    : null

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isActive ? 'border-primary bg-primary/5' : 'border-border'
      } ${step.status === 'waiting_user' ? 'border-yellow-500 bg-yellow-50' : ''}`}
    >
      {/* Step header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}

        <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>

        <StepStatusIcon status={step.status} />

        <ToolIcon tool={step.tool} />

        <span className="flex-1 text-sm text-left truncate">
          {step.thought || step.tool || 'Thinking...'}
        </span>

        {duration !== null && (
          <span className="text-xs text-muted-foreground">{duration}s</span>
        )}
      </button>

      {/* Step details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t space-y-2">
          {/* Waiting for user indicator */}
          {step.status === 'waiting_user' && step.question && (
            <div className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">
              <span className="text-yellow-700 font-medium">⏸️ 等待用户回答: </span>
              <span className="text-yellow-900">{step.question}</span>
            </div>
          )}

          {/* User Response (after answered) */}
          {step.userResponse && (
            <div className="text-xs bg-green-50 border border-green-200 p-2 rounded">
              <span className="text-green-700 font-medium">✅ 用户回答: </span>
              <span className="text-green-900">{step.userResponse}</span>
            </div>
          )}

          {/* Tool info */}
          {step.tool ? (
            <div className="text-xs">
              <span className="text-muted-foreground">Tool: </span>
              <code className="bg-muted px-1 rounded">{step.tool}</code>
            </div>
          ) : null}

          {/* Input */}
          {step.input && typeof step.input === 'object' && Object.keys(step.input).length > 0 ? (
            <div className="text-xs">
              <span className="text-muted-foreground block mb-1">Input:</span>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* Output */}
          {step.output !== undefined ? (
            <div className="text-xs">
              <span className="text-muted-foreground block mb-1">Output:</span>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">
                {typeof step.output === 'object'
                  ? JSON.stringify(step.output, null, 2)
                  : String(step.output)}
              </pre>
            </div>
          ) : null}

          {/* Error */}
          {step.error ? (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              Error: {step.error}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/**
 * 计划面板
 */
function PlanSection({ 
  plan, 
}: { 
  plan: AgentPlan | null
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!plan) return null

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 bg-muted/50 hover:bg-muted transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <Target className="w-4 h-4 text-primary" />
        <span className="flex-1 text-sm font-medium text-left truncate">
          {plan.goal}
        </span>
        <span className="text-xs text-muted-foreground">
          {plan.currentStepIndex}/{plan.steps.length}
        </span>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2">
          {plan.steps.map((step, index) => (
            <AgentStepItem
              key={step.id}
              step={step}
              index={index}
              isActive={index === plan.currentStepIndex}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 事件日志
 */
function EventLog({ events }: { events: AgentEvent[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current && isExpanded) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events, isExpanded])

  const recentEvents = events.slice(-10)

  const getEventIcon = (type: AgentEvent['type']) => {
    switch (type) {
      case 'started':
        return <Play className="w-3 h-3 text-green-500" />
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-green-500" />
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />
      case 'planning':
      case 'planCreated':
        return <Target className="w-3 h-3 text-blue-500" />
      case 'reflecting':
      case 'planAdjusted':
        return <RefreshCw className="w-3 h-3 text-purple-500" />
      case 'toolCalled':
      case 'toolResult':
        return <Wrench className="w-3 h-3 text-orange-500" />
      default:
        return <Eye className="w-3 h-3 text-muted-foreground" />
    }
  }

  const getEventLabel = (event: AgentEvent) => {
    switch (event.type) {
      case 'started':
        return `Started: ${event.goal.slice(0, 30)}...`
      case 'planning':
        return event.thought
      case 'planCreated':
        return `Plan: ${event.plan.steps.length} steps`
      case 'stepStarted':
        return `Step: ${event.step.thought || event.step.tool}`
      case 'stepCompleted':
        return `Done: ${event.step.thought || event.step.tool}`
      case 'toolCalled':
        return `Calling: ${event.tool}`
      case 'toolResult':
        return event.error ? `Tool error: ${event.error}` : `Tool done: ${event.tool}`
      case 'reflecting':
        return event.reflection
      case 'planAdjusted':
        return `Plan adjusted: ${event.reason}`
      case 'completed':
        return event.output.summary
      case 'failed':
        return `Failed: ${event.error}`
      default:
        return event.type
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <Eye className="w-4 h-4" />
        <span className="flex-1 text-sm text-left">Event Log</span>
        <span className="text-xs text-muted-foreground">{events.length}</span>
      </button>

      {isExpanded && (
        <div
          ref={logRef}
          className="max-h-48 overflow-y-auto p-2 space-y-1 text-xs"
        >
          {recentEvents.map((event, i) => (
            <div
              key={i}
              className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0"
            >
              {getEventIcon(event.type)}
              <span className="text-muted-foreground truncate">
                {getEventLabel(event)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export function AgentPanel({
  state,
  events,
  isRunning,
  onPause,
  onResume,
  onAbort,
}: AgentPanelProps) {
  if (!state && events.length === 0) {
    return null
  }

  const statusColors: Record<string, string> = {
    idle: 'bg-gray-500',
    planning: 'bg-blue-500',
    executing: 'bg-green-500',
    reflecting: 'bg-purple-500',
    paused: 'bg-yellow-500',
    completed: 'bg-green-600',
    failed: 'bg-red-500',
  }

  const statusLabels: Record<string, string> = {
    idle: '待机',
    planning: '规划中',
    executing: '执行中',
    reflecting: '反思中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
  }

  return (
    <div className="border rounded-lg bg-background shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">Agent</div>
            {state && (
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${statusColors[state.status] || 'bg-gray-500'}`}
                />
                <span className="text-xs text-muted-foreground">
                  {statusLabels[state.status] || state.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        {isRunning && (
          <div className="flex items-center gap-1">
            {state?.status === 'paused' ? (
              <button
                onClick={() => onResume()}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Resume"
              >
                <Play className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onPause}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Pause"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onAbort}
              className="p-1.5 hover:bg-red-100 text-red-500 rounded transition-colors"
              title="Stop"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {/* Plan */}
        {state?.plan && (
          <PlanSection 
            plan={state.plan} 
          />
        )}

        {/* History (completed steps) */}
        {state?.history && state.history.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium px-1">
              Completed Steps ({state.history.length})
            </div>
            {state.history.slice(-5).map((step, index) => (
              <AgentStepItem
                key={step.id}
                step={step}
                index={state.history.length - 5 + index}
                isActive={false}
              />
            ))}
          </div>
        )}

        {/* Event Log */}
        <EventLog events={events} />

        {/* Error */}
        {state?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <XCircle className="w-4 h-4" />
              <span>Error</span>
            </div>
            <p className="text-xs text-red-600 mt-1">{state.error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentPanel

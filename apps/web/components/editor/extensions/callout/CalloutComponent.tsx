'use client'

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react'
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import type { CalloutType } from './callout'

const CALLOUT_CONFIG: Record<CalloutType, { icon: typeof Info; color: string; bg: string }> = {
  info: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
}

export function CalloutComponent({ node, updateAttributes }: NodeViewProps) {
  const type = node.attrs.type as CalloutType
  const config = CALLOUT_CONFIG[type] || CALLOUT_CONFIG.info
  const Icon = config.icon

  const cycleType = () => {
    const types: CalloutType[] = ['info', 'warning', 'success', 'error']
    const currentIndex = types.indexOf(type)
    const nextIndex = (currentIndex + 1) % types.length
    updateAttributes({ type: types[nextIndex] })
  }

  return (
    <NodeViewWrapper
      className={`callout rounded-lg border p-4 my-2 ${config.bg}`}
      data-type={type}
    >
      <div className="flex gap-3">
        <button
          onClick={cycleType}
          className={`flex-shrink-0 mt-0.5 hover:opacity-70 transition cursor-pointer ${config.color}`}
          contentEditable={false}
          title="Click to change type"
        >
          <Icon className="w-5 h-5" />
        </button>
        <NodeViewContent className="flex-1 min-w-0 prose prose-sm" />
      </div>
    </NodeViewWrapper>
  )
}

export default CalloutComponent

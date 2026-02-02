'use client'

import { useState } from 'react'
import { Check, X, Eye, EyeOff } from 'lucide-react'
import type { EditCommand } from '@/lib/editor/document-parser'

interface EditPreviewPanelProps {
  originalContent: string
  editCommand: EditCommand
  onApply: () => void
  onDiscard: () => void
  onHighlight: () => void
}

export function EditPreviewPanel({
  originalContent,
  editCommand,
  onApply,
  onDiscard,
  onHighlight,
}: EditPreviewPanelProps) {
  const [showDiff, setShowDiff] = useState(true)

  const actionLabels: Record<string, string> = {
    replace: '替换',
    replace_all: '全文替换',
    insert_after: '在后插入',
    insert_before: '在前插入',
    delete: '删除',
  }

  const isReplaceAll = editCommand.action === 'replace_all'

  return (
    <div className="border rounded-lg bg-background shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">编辑预览</span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            isReplaceAll ? 'bg-orange-100 text-orange-700' : 'bg-primary/10 text-primary'
          }`}>
            {actionLabels[editCommand.action] || editCommand.action}
          </span>
          {!isReplaceAll && (
            <span className="text-xs text-muted-foreground">
              目标: {editCommand.targetId}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="p-1 hover:bg-muted rounded text-muted-foreground"
          title={showDiff ? '隐藏对比' : '显示对比'}
        >
          {showDiff ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 max-h-[300px] overflow-auto">
        {/* 全文替换：只显示新内容预览 */}
        {isReplaceAll && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">将替换整篇文档为：</div>
            <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 whitespace-pre-wrap">
              {editCommand.newContent?.slice(0, 500) || '(空)'}
              {(editCommand.newContent?.length || 0) > 500 && (
                <span className="text-muted-foreground">... ({editCommand.newContent?.length} 字符)</span>
              )}
            </div>
          </div>
        )}

        {/* 普通替换/插入：显示对比 */}
        {showDiff && !isReplaceAll && editCommand.action !== 'delete' && (
          <>
            {/* Original */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">原内容</div>
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm line-through text-red-700">
                {originalContent || '(空)'}
              </div>
            </div>

            {/* New */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">新内容</div>
              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                {editCommand.newContent || '(空)'}
              </div>
            </div>
          </>
        )}

        {editCommand.action === 'delete' && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">将删除以下内容</div>
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm line-through text-red-700">
              {originalContent}
            </div>
          </div>
        )}

        {!showDiff && !isReplaceAll && editCommand.newContent && (
          <div className="p-2 border rounded text-sm">
            {editCommand.newContent}
          </div>
        )}

        {/* Explanation */}
        {editCommand.explanation && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            {editCommand.explanation}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between">
        {!isReplaceAll ? (
          <button
            onClick={onHighlight}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            定位到原文
          </button>
        ) : (
          <span className="text-xs text-orange-600">⚠️ 将替换整篇文档</span>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-sm border rounded hover:bg-muted flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            放弃
          </button>
          <button
            onClick={onApply}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            应用
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditPreviewPanel

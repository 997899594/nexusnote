'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { DocumentSnapshot, snapshotStore } from '@/lib/storage'
import * as Y from 'yjs'

interface DiffViewProps {
  snapshot1: DocumentSnapshot
  snapshot2: DocumentSnapshot | null // null means compare with current
  currentYDoc: Y.Doc | null
  onClose: () => void
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed'
  content: string
  lineNumber: { before?: number; after?: number }
}

export function DiffView({ snapshot1, snapshot2, currentYDoc, onClose }: DiffViewProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split')
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')

  useEffect(() => {
    // Get the texts to compare
    if (snapshot2) {
      // Compare two snapshots
      const [older, newer] = snapshot1.timestamp < snapshot2.timestamp
        ? [snapshot1, snapshot2]
        : [snapshot2, snapshot1]
      setBeforeText(older.plainText)
      setAfterText(newer.plainText)
    } else if (currentYDoc) {
      // Compare snapshot with current
      setBeforeText(snapshot1.plainText)
      setAfterText(extractPlainText(currentYDoc))
    }
  }, [snapshot1, snapshot2, currentYDoc])

  const diffLines = useMemo(() => {
    return computeDiff(beforeText, afterText)
  }, [beforeText, afterText])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    for (const line of diffLines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
    return { added, removed }
  }, [diffLines])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">版本对比</h3>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                -{stats.removed} 行
              </span>
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                +{stats.added} 行
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                并排
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                统一
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Version labels */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex-1 px-4 py-2 text-sm">
            <span className="text-zinc-500">旧版本：</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300 ml-1">
              {formatTime(snapshot1.timestamp)}
            </span>
          </div>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex-1 px-4 py-2 text-sm">
            <span className="text-zinc-500">新版本：</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300 ml-1">
              {snapshot2 ? formatTime(snapshot2.timestamp) : '当前'}
            </span>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'split' ? (
            <SplitView diffLines={diffLines} />
          ) : (
            <UnifiedView diffLines={diffLines} />
          )}
        </div>
      </div>
    </div>
  )
}

function SplitView({ diffLines }: { diffLines: DiffLine[] }) {
  // Separate lines for left (before) and right (after) panels
  const leftLines: (DiffLine | null)[] = []
  const rightLines: (DiffLine | null)[] = []

  for (const line of diffLines) {
    if (line.type === 'unchanged') {
      leftLines.push(line)
      rightLines.push(line)
    } else if (line.type === 'removed') {
      leftLines.push(line)
      rightLines.push(null)
    } else if (line.type === 'added') {
      leftLines.push(null)
      rightLines.push(line)
    }
  }

  // Balance the arrays
  const maxLen = Math.max(leftLines.length, rightLines.length)

  return (
    <div className="flex min-h-full">
      {/* Left panel (before) */}
      <div className="flex-1 border-r border-zinc-200 dark:border-zinc-700">
        <div className="font-mono text-sm">
          {leftLines.slice(0, maxLen).map((line, i) => (
            <div
              key={i}
              className={`flex ${
                line?.type === 'removed'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : ''
              }`}
            >
              <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-zinc-400 text-xs border-r border-zinc-200 dark:border-zinc-700 select-none">
                {line?.lineNumber.before || ''}
              </div>
              <div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-all">
                {line ? (
                  <span className={line.type === 'removed' ? 'text-red-700 dark:text-red-400' : ''}>
                    {line.content || '\u00A0'}
                  </span>
                ) : (
                  '\u00A0'
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel (after) */}
      <div className="flex-1">
        <div className="font-mono text-sm">
          {rightLines.slice(0, maxLen).map((line, i) => (
            <div
              key={i}
              className={`flex ${
                line?.type === 'added'
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : ''
              }`}
            >
              <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-zinc-400 text-xs border-r border-zinc-200 dark:border-zinc-700 select-none">
                {line?.lineNumber.after || ''}
              </div>
              <div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-all">
                {line ? (
                  <span className={line.type === 'added' ? 'text-green-700 dark:text-green-400' : ''}>
                    {line.content || '\u00A0'}
                  </span>
                ) : (
                  '\u00A0'
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UnifiedView({ diffLines }: { diffLines: DiffLine[] }) {
  return (
    <div className="font-mono text-sm">
      {diffLines.map((line, i) => (
        <div
          key={i}
          className={`flex ${
            line.type === 'added'
              ? 'bg-green-50 dark:bg-green-900/20'
              : line.type === 'removed'
              ? 'bg-red-50 dark:bg-red-900/20'
              : ''
          }`}
        >
          <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-zinc-400 text-xs border-r border-zinc-200 dark:border-zinc-700 select-none">
            {line.lineNumber.before || ''}
          </div>
          <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-zinc-400 text-xs border-r border-zinc-200 dark:border-zinc-700 select-none">
            {line.lineNumber.after || ''}
          </div>
          <div className="w-6 flex-shrink-0 text-center py-0.5 select-none">
            {line.type === 'added' ? (
              <span className="text-green-600">+</span>
            ) : line.type === 'removed' ? (
              <span className="text-red-600">-</span>
            ) : (
              ' '
            )}
          </div>
          <div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-all">
            <span
              className={
                line.type === 'added'
                  ? 'text-green-700 dark:text-green-400'
                  : line.type === 'removed'
                  ? 'text-red-700 dark:text-red-400'
                  : ''
              }
            >
              {line.content || '\u00A0'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Simple line-by-line diff algorithm
 */
function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  // Use Myers diff algorithm (simplified version using LCS)
  const lcs = longestCommonSubsequence(beforeLines, afterLines)

  const result: DiffLine[] = []
  let beforeIdx = 0
  let afterIdx = 0
  let beforeLineNum = 1
  let afterLineNum = 1

  for (const [bi, ai] of lcs) {
    // Add removed lines
    while (beforeIdx < bi) {
      result.push({
        type: 'removed',
        content: beforeLines[beforeIdx],
        lineNumber: { before: beforeLineNum++ },
      })
      beforeIdx++
    }

    // Add added lines
    while (afterIdx < ai) {
      result.push({
        type: 'added',
        content: afterLines[afterIdx],
        lineNumber: { after: afterLineNum++ },
      })
      afterIdx++
    }

    // Add unchanged line
    result.push({
      type: 'unchanged',
      content: beforeLines[beforeIdx],
      lineNumber: { before: beforeLineNum++, after: afterLineNum++ },
    })
    beforeIdx++
    afterIdx++
  }

  // Add remaining removed lines
  while (beforeIdx < beforeLines.length) {
    result.push({
      type: 'removed',
      content: beforeLines[beforeIdx],
      lineNumber: { before: beforeLineNum++ },
    })
    beforeIdx++
  }

  // Add remaining added lines
  while (afterIdx < afterLines.length) {
    result.push({
      type: 'added',
      content: afterLines[afterIdx],
      lineNumber: { after: afterLineNum++ },
    })
    afterIdx++
  }

  return result
}

/**
 * Compute LCS indices
 */
function longestCommonSubsequence(a: string[], b: string[]): [number, number][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find the LCS
  const lcs: [number, number][] = []
  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift([i - 1, j - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

/**
 * Extract plain text from YDoc
 */
function extractPlainText(ydoc: Y.Doc): string {
  try {
    const content = ydoc.getXmlFragment('default')
    return xmlFragmentToText(content)
  } catch {
    return ''
  }
}

function xmlFragmentToText(fragment: Y.XmlFragment): string {
  let text = ''
  fragment.forEach((item) => {
    if (item instanceof Y.XmlText) {
      text += item.toString()
    } else if (item instanceof Y.XmlElement) {
      text += xmlElementToText(item)
    }
  })
  return text
}

function xmlElementToText(element: Y.XmlElement): string {
  let text = ''
  element.forEach((item) => {
    if (item instanceof Y.XmlText) {
      text += item.toString()
    } else if (item instanceof Y.XmlElement) {
      text += xmlElementToText(item)
    }
  })
  const blockTags = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem']
  if (blockTags.includes(element.nodeName)) {
    text += '\n'
  }
  return text
}

'use client'

import { useState } from 'react'
import { useDocumentGeneration, type Chapter } from '@/hooks/useDocumentGeneration'
import { Loader2, FileText, AlertCircle, ChevronRight, Square } from 'lucide-react'

/**
 * DocumentGeneratorPanel - 文档生成组件
 *
 * 演示 AI SDK v6 的 streamObject + useObject 模式：
 * - 服务端 streamObject 流式返回结构化 JSON
 * - 客户端 useObject 实时解析为 partial object
 * - 章节逐个出现，内容渐进填充
 */
export function DocumentGeneratorPanel() {
  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState<'shallow' | 'medium' | 'deep'>('medium')
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())
  const { generate, outline, isLoading, error, stop } = useDocumentGeneration()

  const handleGenerate = () => {
    if (!topic.trim()) return
    setExpandedChapters(new Set())
    generate({ topic: topic.trim(), depth })
  }

  const toggleChapter = (index: number) => {
    const newExpanded = new Set(expandedChapters)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedChapters(newExpanded)
  }

  return (
    <div className="flex-1 flex flex-col gap-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-500" />
            文档生成助手
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            AI 驱动的流式结构化大纲生成（streamObject + useObject）
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
            文档主题
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="输入文档主题，如 'React 性能优化'..."
            disabled={isLoading}
            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all disabled:opacity-50"
          />
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              详细程度
            </label>
            <select
              value={depth}
              onChange={(e) => setDepth(e.target.value as 'shallow' | 'medium' | 'deep')}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all disabled:opacity-50"
            >
              <option value="shallow">简要（3 章）</option>
              <option value="medium">适中（5 章）</option>
              <option value="deep">详细（8 章）</option>
            </select>
          </div>

          {isLoading ? (
            <button
              onClick={stop}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
            >
              <Square className="w-4 h-4" />
              停止
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!topic.trim()}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-violet-900/20"
            >
              <FileText className="w-4 h-4" />
              生成文档
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-[300px] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 overflow-y-auto">
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-200">生成失败</h3>
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {isLoading && outline.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">正在生成文档结构...</p>
          </div>
        )}

        {outline.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                文档大纲
              </span>
              {isLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
              )}
              <span className="text-xs text-slate-400">
                {outline.length} 章节
              </span>
            </div>
            <ChapterTree
              chapters={outline}
              expandedChapters={expandedChapters}
              onToggle={toggleChapter}
              isStreaming={isLoading}
            />
          </div>
        )}

        {!isLoading && outline.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FileText className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">输入主题并点击生成开始</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface ChapterTreeProps {
  chapters: Array<Partial<Chapter>>
  expandedChapters: Set<number>
  onToggle: (index: number) => void
  isStreaming: boolean
}

function ChapterTree({ chapters, expandedChapters, onToggle, isStreaming }: ChapterTreeProps) {
  return (
    <div className="space-y-1">
      {chapters.map((chapter, index) => (
        <ChapterItem
          key={index}
          chapter={chapter}
          index={index}
          isExpanded={expandedChapters.has(index)}
          onToggle={onToggle}
          isLastAndStreaming={isStreaming && index === chapters.length - 1}
        />
      ))}
    </div>
  )
}

interface ChapterItemProps {
  chapter: Partial<Chapter>
  index: number
  isExpanded: boolean
  onToggle: (index: number) => void
  isLastAndStreaming: boolean
}

function ChapterItem({ chapter, index, isExpanded, onToggle, isLastAndStreaming }: ChapterItemProps) {
  const level = chapter.level ?? 1

  const fontSize = {
    1: 'text-base font-semibold',
    2: 'text-sm font-medium',
    3: 'text-xs',
  }[level] || 'text-sm'

  const paddingLeft = {
    1: '',
    2: 'pl-4',
    3: 'pl-8',
  }[level] || ''

  return (
    <div className={paddingLeft}>
      <button
        onClick={() => onToggle(index)}
        className={`w-full flex items-start gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-left group ${fontSize}`}
      >
        <ChevronRight
          className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          } text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300`}
        />
        <span className="text-slate-900 dark:text-slate-100">
          {chapter.title || (
            <span className="inline-block w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          )}
        </span>
        {isLastAndStreaming && (
          <Loader2 className="w-3 h-3 animate-spin text-violet-500 ml-auto flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="pl-6 py-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {chapter.content || (
            <span className="inline-block w-48 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          )}
        </div>
      )}
    </div>
  )
}

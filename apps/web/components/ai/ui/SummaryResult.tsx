/**
 * Summary Result UI Component
 *
 * 渲染 summarize 工具生成的摘要
 */
'use client'

import { FileText, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface SummaryResultProps {
  content: string
  sourceLength: number
  style: 'bullet_points' | 'paragraph' | 'key_takeaways'
  length: 'brief' | 'medium' | 'detailed'
}

export function SummaryResult({ content, sourceLength, style, length }: SummaryResultProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const lengthLabels = {
    brief: '简要',
    medium: '中等',
    detailed: '详细',
  }

  const styleLabels = {
    bullet_points: '要点列表',
    paragraph: '段落形式',
    key_takeaways: '核心要点',
  }

  const compressionRatio = Math.round((1 - content.length / sourceLength) * 100)

  return (
    <div className="my-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">智能摘要</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {lengthLabels[length]} · {styleLabels[style]}
              </span>
              {compressionRatio > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded">
                  压缩 {compressionRatio}%
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={copyToClipboard}
          className="p-2 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors"
          title="复制摘要"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Summary Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-sm"
      >
        <div
          className={`text-sm leading-relaxed ${
            style === 'bullet_points' ? 'space-y-2' : 'whitespace-pre-wrap'
          }`}
        >
          {style === 'bullet_points' && content.includes('\n') ? (
            content.split('\n').filter(line => line.trim()).map((line, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-emerald-500 mt-1">•</span>
                <span className="flex-1">{line.replace(/^[•\-\*]\s*/, '')}</span>
              </div>
            ))
          ) : (
            <p>{content}</p>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <span>原文 {sourceLength} 字</span>
        <span>·</span>
        <span>摘要 {content.length} 字</span>
      </div>
    </div>
  )
}

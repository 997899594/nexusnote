/**
 * QuizSkeleton - 测验生成加载状态
 *
 * 显示正在生成测验时的骨架屏
 */
'use client'

import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'

interface QuizSkeletonProps {
  questionCount?: number
}

export function QuizSkeleton({ questionCount = 5 }: QuizSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-3xl p-6 border border-violet-100 dark:border-violet-900/30"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-violet-900 dark:text-violet-100">
            正在生成测验
          </h3>
          <p className="text-xs text-violet-600/70 dark:text-violet-400/70">
            AI 正在分析内容并设计题目...
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-violet-100 dark:bg-violet-900/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '60%' }}
            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
          />
        </div>
      </div>

      {/* Question Placeholders */}
      <div className="space-y-3">
        {Array.from({ length: Math.min(questionCount, 3) }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/60 dark:bg-black/20 rounded-xl p-4 border border-violet-100 dark:border-violet-900/20"
          >
            {/* Question text skeleton */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 rounded-full bg-violet-200 dark:bg-violet-800/50 flex items-center justify-center">
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                  {i + 1}
                </span>
              </div>
              <div className="flex-1 h-4 bg-violet-100 dark:bg-violet-900/30 rounded animate-pulse" />
            </div>

            {/* Options skeleton */}
            <div className="ml-9 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="h-3 bg-violet-50 dark:bg-violet-900/20 rounded w-[80%] animate-pulse"
                  style={{ animationDelay: `${j * 0.1}s` }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Loading hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 flex items-center gap-2 text-xs text-violet-600/60 dark:text-violet-400/60"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="ml-1">正在设计 {questionCount} 道题目...</span>
      </motion.div>
    </motion.div>
  )
}

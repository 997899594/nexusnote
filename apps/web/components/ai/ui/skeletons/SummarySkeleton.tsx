/**
 * SummarySkeleton - 摘要生成加载状态
 *
 * 显示正在生成摘要时的骨架屏
 */
"use client";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";

interface SummarySkeletonProps {
  style?: "bullet_points" | "paragraph" | "key_takeaways";
  length?: "brief" | "medium" | "detailed";
}

export function SummarySkeleton({
  style = "bullet_points",
  length = "medium",
}: SummarySkeletonProps) {
  const lines = {
    brief: 2,
    medium: 4,
    detailed: 6,
  }[length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-3xl p-6 border border-amber-100 dark:border-amber-900/30"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">正在生成摘要</h3>
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70">AI 正在提取关键信息...</p>
        </div>
      </div>

      {/* Style Badge */}
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-300">
          {style === "bullet_points" && "要点列表"}
          {style === "paragraph" && "段落形式"}
          {style === "key_takeaways" && "核心要点"}
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </span>
      </div>

      {/* Content Skeleton */}
      <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/20">
        {style === "paragraph" ? (
          // Paragraph style skeleton
          <div className="space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="space-y-2"
              >
                <div className="h-4 bg-amber-100 dark:bg-amber-900/30 rounded animate-pulse w-full" />
                {i < lines - 1 && (
                  <div className="h-4 bg-amber-100 dark:bg-amber-900/30 rounded animate-pulse w-[80%]" />
                )}
              </motion.div>
            ))}
          </div>
        ) : style === "key_takeaways" ? (
          // Numbered list skeleton
          <div className="space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-amber-100 dark:bg-amber-900/30 rounded animate-pulse w-full" />
                  {i % 2 === 0 && (
                    <div className="h-4 bg-amber-100 dark:bg-amber-900/30 rounded animate-pulse w-[60%]" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          // Bullet points skeleton (default)
          <div className="space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-amber-100 dark:bg-amber-900/30 rounded animate-pulse w-full" />
                  {i % 3 === 0 && (
                    <div className="h-4 bg-amber-100 dark:bg-amber-900/30 rounded animate-pulse w-[70%]" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Source info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 flex items-center gap-2 text-xs text-amber-600/60 dark:text-amber-400/60"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>
          正在分析原文并提取 {length === "brief" ? "简要" : length === "detailed" ? "详细" : "适中"}
          摘要...
        </span>
      </motion.div>
    </motion.div>
  );
}

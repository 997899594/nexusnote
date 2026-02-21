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
      className="glass glass-lg rounded-2xl p-4 xs:p-6 border-l-4 border-primary/50"
    >
      <div className="flex items-center gap-3 mb-4 xs:mb-6">
        <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-float">
          <FileText className="w-4 h-4 xs:w-5 xs:h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xs xs:text-sm font-semibold text-foreground">正在生成摘要</h3>
          <p className="text-[10px] xs:text-xs text-muted-foreground">AI 正在提取关键信息...</p>
        </div>
      </div>

      <div className="mb-3 xs:mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-[10px] xs:text-xs font-medium text-primary">
          {style === "bullet_points" && "要点列表"}
          {style === "paragraph" && "段落形式"}
          {style === "key_takeaways" && "核心要点"}
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </span>
      </div>

      <div className="glass p-3 xs:p-4 rounded-xl">
        {style === "paragraph" ? (
          <div className="space-y-2 xs:space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="space-y-2"
              >
                <div className="h-3 xs:h-4 skeleton-gradient rounded w-full" />
                {i < lines - 1 && <div className="h-3 xs:h-4 skeleton-gradient rounded w-[80%]" />}
              </motion.div>
            ))}
          </div>
        ) : style === "key_takeaways" ? (
          <div className="space-y-2 xs:space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-5 h-5 xs:w-6 xs:h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] xs:text-xs font-bold text-primary">{i + 1}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 xs:h-4 skeleton-gradient rounded w-full" />
                  {i % 2 === 0 && <div className="h-3 xs:h-4 skeleton-gradient rounded w-[60%]" />}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 xs:space-y-3">
            {Array.from({ length: lines }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 xs:h-4 skeleton-gradient rounded w-full" />
                  {i % 3 === 0 && <div className="h-3 xs:h-4 skeleton-gradient rounded w-[70%]" />}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-3 xs:mt-4 flex items-center gap-2 text-[10px] xs:text-xs text-muted-foreground"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span>
          正在分析原文并提取 {length === "brief" ? "简要" : length === "detailed" ? "详细" : "适中"}
          摘要...
        </span>
      </motion.div>
    </motion.div>
  );
}

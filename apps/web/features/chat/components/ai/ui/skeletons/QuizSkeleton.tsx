"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

interface QuizSkeletonProps {
  questionCount?: number;
}

export function QuizSkeleton({ questionCount = 5 }: QuizSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass glass-lg rounded-2xl p-4 xs:p-6 border-l-4 border-primary/50"
    >
      <div className="flex items-center gap-3 mb-4 xs:mb-6">
        <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-float">
          <Brain className="w-4 h-4 xs:w-5 xs:h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xs xs:text-sm font-semibold text-foreground">正在生成测验</h3>
          <p className="text-[10px] xs:text-xs text-muted-foreground">
            AI 正在分析内容并设计题目...
          </p>
        </div>
      </div>

      <div className="mb-4 xs:mb-6">
        <div className="h-1.5 xs:h-2 bg-surface/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "60%" }}
            transition={{
              duration: 1.5,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "reverse",
            }}
            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
          />
        </div>
      </div>

      <div className="space-y-2 xs:space-y-3">
        {Array.from({ length: Math.min(questionCount, 3) }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-3 xs:p-4 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-2 xs:mb-3">
              <div className="w-5 h-5 xs:w-6 xs:h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] xs:text-xs font-bold text-primary">{i + 1}</span>
              </div>
              <div className="flex-1 h-3 xs:h-4 skeleton-gradient rounded" />
            </div>

            <div className="ml-8 xs:ml-9 space-y-1.5 xs:space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="h-2.5 xs:h-3 skeleton-gradient rounded w-[80%] animate-pulse"
                  style={{ animationDelay: `${j * 0.1}s` }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-3 xs:mt-4 flex items-center gap-2 text-[10px] xs:text-xs text-muted-foreground"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <span className="ml-1">正在设计 {questionCount} 道题目...</span>
      </motion.div>
    </motion.div>
  );
}

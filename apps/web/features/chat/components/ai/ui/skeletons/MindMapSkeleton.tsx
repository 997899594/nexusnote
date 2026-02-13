/**
 * MindMapSkeleton - 思维导图生成加载状态
 *
 * 显示正在生成思维导图时的骨架屏
 */
"use client";

import { motion } from "framer-motion";
import { Network } from "lucide-react";
import { useEffect, useState } from "react";

interface MindMapSkeletonProps {
  maxDepth?: number;
}

export function MindMapSkeleton({ maxDepth = 3 }: MindMapSkeletonProps) {
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseCount((c) => (c + 1) % 4);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // 模拟节点发散动画
  const branches = [
    { angle: 0, delay: 0 },
    { angle: 72, delay: 0.1 },
    { angle: 144, delay: 0.2 },
    { angle: 216, delay: 0.3 },
    { angle: 288, delay: 0.4 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-3xl p-6 border border-emerald-100 dark:border-emerald-900/30"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Network className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">正在构建思维导图</h3>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
            AI 正在分析知识结构...
          </p>
        </div>
      </div>

      {/* Mind Map Visualization */}
      <div className="relative h-48 bg-white/60 dark:bg-black/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 overflow-hidden">
        {/* Central Node */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg flex items-center justify-center z-10"
        >
          <Network className="w-6 h-6 text-white" />
        </motion.div>

        {/* Branch Nodes */}
        {branches.map((branch, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: pulseCount > i ? 1 : 0,
              opacity: pulseCount > i ? 1 : 0,
            }}
            transition={{ duration: 0.4, delay: branch.delay }}
            className="absolute top-1/2 left-1/2"
            style={{
              transform: `translate(-50%, -50%) rotate(${branch.angle}deg) translateX(50px)`,
            }}
          >
            <div className="w-8 h-8 rounded-full bg-emerald-200 dark:bg-emerald-700/50 border-2 border-emerald-400 dark:border-emerald-500" />
          </motion.div>
        ))}

        {/* Connection Lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {branches.map((branch, i) => (
            <motion.line
              key={i}
              x1="50%"
              y1="50%"
              x2="50%"
              y2="50%"
              stroke={pulseCount > i ? "#10b981" : "#d1fae5"}
              strokeWidth="2"
              strokeDasharray="5,5"
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: pulseCount > i ? 1 : 0,
                x2: `calc(50% + ${Math.cos((branch.angle * Math.PI) / 180) * 58}px)`,
                y2: `calc(50% + ${Math.sin((branch.angle * Math.PI) / 180) * 58}px)`,
              }}
              transition={{ duration: 0.4, delay: branch.delay }}
            />
          ))}
        </svg>

        {/* Depth indicator */}
        <div className="absolute bottom-2 left-2 text-xs text-emerald-600/60 dark:text-emerald-400/60">
          深度: {maxDepth} 层
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: pulseCount >= i ? 1 : 0.5 }}
              transition={{ duration: 0.2 }}
              className={`w-2 h-2 rounded-full ${
                pulseCount >= i ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-800"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-emerald-600/60 dark:text-emerald-400/60">
          正在生成节点结构...
        </span>
      </div>
    </motion.div>
  );
}

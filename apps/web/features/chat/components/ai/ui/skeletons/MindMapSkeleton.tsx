"use client";

import { motion } from "framer-motion";
import { Network } from "lucide-react";
import { useState, useEffect } from "react";

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
      className="glass glass-lg rounded-2xl p-4 xs:p-6 border-l-4 border-primary/50"
    >
      <div className="flex items-center gap-3 mb-4 xs:mb-6">
        <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-float">
          <Network className="w-4 h-4 xs:w-5 xs:h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xs xs:text-sm font-semibold text-foreground">
            正在构建思维导图
          </h3>
          <p className="text-[10px] xs:text-xs text-muted-foreground">
            AI 正在分析知识结构...
          </p>
        </div>
      </div>

      <div className="relative h-40 xs:h-48 glass rounded-2xl overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 xs:w-16 xs:h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-float flex items-center justify-center z-10"
        >
          <Network className="w-5 h-5 xs:w-6 xs:h-6 text-primary-foreground" />
        </motion.div>

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
              transform: `translate(-50%, -50%) rotate(${branch.angle}deg) translateX(40px)`,
            }}
          >
            <div className="w-6 h-6 xs:w-8 xs:h-8 rounded-full bg-primary/30 border-2 border-primary/50" />
          </motion.div>
        ))}

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {branches.map((branch, i) => (
            <motion.line
              key={i}
              x1="50%"
              y1="50%"
              x2="50%"
              y2="50%"
              stroke={pulseCount > i ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.3)'}
              strokeWidth="2"
              strokeDasharray="5,5"
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: pulseCount > i ? 1 : 0,
                x2: `calc(50% + ${Math.cos((branch.angle * Math.PI) / 180) * 48}px)`,
                y2: `calc(50% + ${Math.sin((branch.angle * Math.PI) / 180) * 48}px)`,
              }}
              transition={{ duration: 0.4, delay: branch.delay }}
            />
          ))}
        </svg>

        <div className="absolute bottom-2 left-2 text-[10px] xs:text-xs text-muted-foreground">
          深度: {maxDepth} 层
        </div>
      </div>

      <div className="mt-3 xs:mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: pulseCount >= i ? 1 : 0.5 }}
              transition={{ duration: 0.2 }}
              className={`w-1.5 h-1.5 xs:w-2 xs:h-2 rounded-full ${
                pulseCount >= i
                  ? 'bg-primary'
                  : 'bg-primary/20'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] xs:text-xs text-muted-foreground">
          正在生成节点结构...
        </span>
      </div>
    </motion.div>
  );
}

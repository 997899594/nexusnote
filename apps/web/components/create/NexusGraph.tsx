"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Sparkles, Loader2 } from "lucide-react";
import { CourseNode } from "@/lib/types/course";

interface NexusGraphProps {
  nodes: CourseNode[];
  selectedNode: string | null;
  onNodeClick: (id: string) => void;
  phase: string;
  goal: string;
}

export function NexusGraph({
  nodes,
  selectedNode,
  onNodeClick,
  phase,
  goal,
}: NexusGraphProps) {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center transition-all duration-1000 ${
        phase === "interview" ||
        phase === "synthesis" ||
        phase === "outline_review"
          ? "opacity-40 scale-90 blur-[100px] pointer-events-none"
          : "opacity-100 scale-100 blur-0"
      }`}
    >
      {/* Central Seed */}
      <motion.div
        layoutId="seed"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="relative z-50 flex flex-col items-center pointer-events-auto"
      >
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-[48px] bg-black shadow-2xl shadow-black/20 flex items-center justify-center group cursor-pointer active:scale-95 transition-transform">
          {phase === "seeding" ? (
            <Loader2 className="w-10 h-10 text-white animate-spin opacity-50" />
          ) : (
            <Sparkles className="w-10 h-10 text-white" />
          )}

          {/* Pulse rings */}
          <motion.div
            animate={{ scale: [1, 2], opacity: [0.2, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 rounded-[48px] border-2 border-black"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-center"
        >
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-black">
            {goal}
          </h1>
          <p className="text-[10px] font-bold text-black/20 uppercase tracking-[0.3em] mt-2">
            {phase === "seeding"
              ? "正在分析你的学习目标..."
              : phase === "growing"
                ? "正在构建知识图谱..."
                : "图谱构建完成，可点击节点微调"}
          </p>
        </motion.div>
      </motion.div>

      {/* Connected Nodes */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence>
          {nodes.map((node) => (
            <NexusNode
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              onClick={() => onNodeClick(node.id)}
            />
          ))}
        </AnimatePresence>

        {/* Connection Lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop
                offset="0%"
                style={{ stopColor: "black", stopOpacity: 0.1 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: "black", stopOpacity: 0 }}
              />
            </linearGradient>
          </defs>
          {nodes.map((node) => (
            <motion.line
              key={`line-${node.id}`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              x1="50%"
              y1="50%"
              x2={`calc(50% + ${node.x}px)`}
              y2={`calc(50% + ${node.y}px)`}
              stroke="black"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="opacity-10"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function NexusNode({
  node,
  isSelected,
  onClick,
}: {
  node: CourseNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
      animate={{
        scale: 1,
        x: node.x,
        y: node.y,
        opacity: 1,
      }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: parseInt(node.id.split("-")[1] || "0") * 0.2,
      }}
      className="absolute pointer-events-auto group"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div
        className={`
        relative flex flex-col items-center gap-4 cursor-pointer transition-all duration-500
        ${isSelected ? "scale-110" : "hover:scale-105"}
      `}
      >
        {/* Node Circle */}
        <div
          className={`
          w-12 h-12 md:w-16 md:h-16 rounded-[24px] md:rounded-[32px] flex items-center justify-center transition-all duration-500
          ${node.status === "generating" ? "bg-black/[0.03] animate-pulse" : "bg-white shadow-xl shadow-black/5 border border-black/[0.03]"}
          ${isSelected ? "border-black ring-4 ring-black/5" : ""}
        `}
        >
          {node.status === "generating" ? (
            <div className="w-2 h-2 rounded-full bg-black/20" />
          ) : (
            <BookOpen
              className={`w-5 h-5 md:w-6 md:h-6 ${isSelected ? "text-black" : "text-black/20"}`}
            />
          )}
        </div>

        {/* Title Tooltip-style */}
        <div
          className={`
          absolute top-full mt-4 px-4 py-2 rounded-2xl whitespace-nowrap transition-all duration-500 pointer-events-none z-50
          ${isSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          ${isSelected ? "bg-black text-white shadow-2xl" : "bg-black/[0.05] backdrop-blur-md text-black/60"}
        `}
        >
          <span className="text-[10px] md:text-xs font-bold tracking-tight">
            {node.title}
          </span>
          {isSelected && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              className="h-[1px] bg-white/20 mt-2"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

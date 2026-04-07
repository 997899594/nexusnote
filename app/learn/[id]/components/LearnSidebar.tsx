"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Clock, Sparkles, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  courseTitle: string;
  width: number;
}

const contentVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// Circular progress ring
function ProgressRing({ progress, size = 52 }: { progress: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label="学习进度">
        <title>学习进度</title>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#c58f2a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-[#8c6a24]">{progress}%</span>
      </div>
    </div>
  );
}

export function LearnSidebar({ courseTitle, width }: LearnSidebarProps) {
  const router = useRouter();
  const { chapters, completedSections } = useLearnStore();

  const totalSections = chapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  const completedCount = completedSections.size;
  const progress = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div
      className="flex h-full w-full flex-col bg-[#f6f7f9] safe-top safe-bottom"
      style={{ maxWidth: width }}
    >
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col h-full"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 border-b border-black/5 px-5 pb-4 pt-5"
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8bc7b]/28 bg-[radial-gradient(circle_at_top_left,rgba(232,205,141,0.16),transparent_55%),linear-gradient(180deg,#fffdf8_0%,#fff8ef_100%)]",
              "text-[#745b25]",
              "hover:text-[#5f4716]",
              "transition-all duration-200",
            )}
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              课程工作台
            </div>
            <h1 className="text-[0.9375rem] font-semibold text-[var(--color-text)] truncate leading-snug">
              {courseTitle}
            </h1>
          </div>
        </motion.div>

        {/* Progress card */}
        <motion.div
          variants={itemVariants}
          className="mx-4 mb-4 mt-4 rounded-[28px] border border-[#d8bc7b]/28 bg-[radial-gradient(circle_at_top_left,rgba(232,205,141,0.18),transparent_38%),linear-gradient(180deg,#fffdf8_0%,#fffaf1_100%)] p-4 shadow-[0_24px_56px_-40px_rgba(197,143,42,0.18)]"
        >
          <div className="flex items-center gap-4">
            <ProgressRing progress={progress} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5 text-[#8c6a24]" />
                <span className="text-xs font-semibold text-[#5f4716]">命途进度</span>
              </div>
              <p className="text-xs text-[#7b6024]">
                已完成 {completedCount} / {totalSections} 节
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-[0.6875rem] text-[#8c7440]">
                  <Clock className="w-3 h-3" />
                  <span>约 {totalSections * 10} 分钟</span>
                </div>
                {completedCount > 0 && (
                  <div className="flex items-center gap-1 text-[0.6875rem] text-[#6f5316]">
                    <Sparkles className="w-3 h-3" />
                    <span>进行中</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chapter list header */}
        <motion.div variants={itemVariants} className="px-5 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.6875rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              课程大纲
            </h2>
            <span className="text-[0.6875rem] text-[var(--color-text-tertiary)]">
              {chapters.length} 章
            </span>
          </div>
        </motion.div>

        {/* Chapter > Section list */}
        <div className="mobile-scroll flex-1 overflow-y-auto px-3 pb-5">
          <ChapterList />
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Brain, Clock, Compass, Sparkles, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { getGrowthStateLabel } from "@/lib/growth/presentation";
import type { GrowthFocusSummary, GrowthInsightSummary } from "@/lib/growth/projection-types";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  courseTitle: string;
  width: number;
  growthFocus: GrowthFocusSummary | null;
  insights: GrowthInsightSummary[];
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
          stroke="var(--color-panel-strong)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-[var(--color-text)]">{progress}%</span>
      </div>
    </div>
  );
}

export function LearnSidebar({ courseTitle, width, growthFocus, insights }: LearnSidebarProps) {
  const router = useRouter();
  const { chapters, completedSections } = useLearnStore();

  const totalSections = chapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  const completedCount = completedSections.size;
  const progress = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div
      className="ui-page-shell flex h-full w-full flex-col safe-top safe-bottom"
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
              "ui-control-surface flex h-9 w-9 items-center justify-center rounded-lg",
              "text-[var(--color-text-secondary)]",
              "hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
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
          className="ui-message-card mx-4 mb-4 mt-4 rounded-[28px] p-4"
        >
          <div className="flex items-center gap-4">
            <ProgressRing progress={progress} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                <span className="text-xs font-semibold text-[var(--color-text)]">学习进度</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                已完成 {completedCount} / {totalSections} 节
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-[0.6875rem] text-[var(--color-text-tertiary)]">
                  <Clock className="w-3 h-3" />
                  <span>约 {totalSections * 10} 分钟</span>
                </div>
                {completedCount > 0 && (
                  <div className="flex items-center gap-1 text-[0.6875rem] text-[var(--color-text-secondary)]">
                    <Sparkles className="w-3 h-3" />
                    <span>进行中</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Growth alignment */}
        {growthFocus ? (
          <motion.div
            variants={itemVariants}
            className="ui-message-card mx-4 mb-4 rounded-[28px] p-4"
          >
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Compass className="h-3.5 w-3.5" />
              当前成长焦点
            </div>
            <h3 className="mt-3 text-sm font-semibold leading-6 text-[var(--color-text)]">
              {growthFocus.title}
            </h3>
            <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
              {growthFocus.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[0.6875rem] text-[var(--color-text-secondary)]">
              <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1">
                进度 {growthFocus.progress}%
              </span>
              <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1">
                {getGrowthStateLabel(growthFocus.state)}
              </span>
            </div>
          </motion.div>
        ) : null}

        {insights.length > 0 ? (
          <motion.div
            variants={itemVariants}
            className="ui-message-card mx-4 mb-4 rounded-[28px] p-4"
          >
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Brain className="h-3.5 w-3.5" />
              最近成长信号
            </div>
            <div className="mt-3 space-y-3">
              {insights.slice(0, 2).map((insight) => (
                <div
                  key={insight.id}
                  className="rounded-2xl bg-[var(--color-panel-soft)] px-3 py-3"
                >
                  <div className="text-xs font-medium text-[var(--color-text)]">
                    {insight.title}
                  </div>
                  <div className="mt-1 text-[0.6875rem] leading-5 text-[var(--color-text-secondary)]">
                    {insight.summary}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}

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

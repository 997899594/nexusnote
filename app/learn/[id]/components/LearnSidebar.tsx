"use client";

import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clock, Sparkles, Trophy } from "lucide-react";
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
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function LearnSidebar({ courseTitle, width }: LearnSidebarProps) {
  const router = useRouter();
  const { chapters, completedSections } = useLearnStore();

  // Count total sections across all chapters
  const totalSections = chapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  const completedCount = completedSections.size;
  const progress = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div
      className="flex flex-col h-full border-r border-[var(--color-border)] bg-white"
      style={{ width }}
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
          className="flex items-center gap-3 px-5 py-5 border-b border-[var(--color-border)]"
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              "bg-[var(--color-bg-secondary)] text-zinc-600",
              "hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)]",
              "transition-all duration-200",
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 truncate">{courseTitle}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <BookOpen className="w-3 h-3 text-zinc-400" />
              <p className="text-xs text-zinc-500">
                {completedCount} / {totalSections} 节完成
              </p>
            </div>
          </div>
        </motion.div>

        {/* Progress */}
        <motion.div
          variants={itemVariants}
          className="px-5 py-5 border-b border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <span className="text-sm font-medium text-zinc-700">学习进度</span>
            </div>
            <span className="text-lg font-bold text-[var(--color-accent)]">{progress}%</span>
          </div>

          <div className="relative h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-hover)] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            {progress > 0 && (
              <motion.div
                className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ["-100%", "400%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
              />
            )}
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock className="w-3.5 h-3.5" />
              <span>预计 {totalSections * 10} 分钟</span>
            </div>
            {completedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-accent)]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>已完成 {completedCount} 节</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Chapter list header */}
        <motion.div variants={itemVariants} className="px-5 py-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">课程大纲</h2>
        </motion.div>

        {/* Chapter > Section list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <ChapterList />
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut" as const,
    },
  },
};

export function ChapterList() {
  const chapters = useLearnStore((state) => state.chapters);
  const currentChapterIndex = useLearnStore((state) => state.currentChapterIndex);
  const completedChapters = useLearnStore((state) => state.completedChapters);
  const setCurrentChapterIndex = useLearnStore((state) => state.setCurrentChapterIndex);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <Circle className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">暂无章节内容</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      <AnimatePresence mode="popLayout">
        {chapters.map((chapter, index) => {
          const isCompleted = completedChapters.has(chapter.id);
          const isCurrent = index === currentChapterIndex;
          const isLocked = false; // Future: implement chapter locking

          return (
            <motion.button
              key={chapter.id}
              variants={itemVariants}
              layout
              type="button"
              onClick={() => !isLocked && setCurrentChapterIndex(index)}
              disabled={isLocked}
              className={cn(
                "group w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200",
                isCurrent
                  ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-50",
                isCompleted && !isCurrent && "text-zinc-500",
                isLocked && "opacity-50 cursor-not-allowed",
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  "relative w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-all duration-300",
                  isCompleted
                    ? "bg-[var(--color-accent)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-accent)] text-white ring-4 ring-[var(--color-accent-light)]"
                      : "bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200",
                )}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Check className="w-4 h-4" />
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Play className="w-4 h-4 ml-0.5" />
                  </motion.div>
                ) : (
                  <span>{index + 1}</span>
                )}

                {/* Current playing indicator */}
                {isCurrent && !isCompleted && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block text-sm truncate transition-colors",
                    isCurrent && "font-semibold",
                    isCompleted && !isCurrent && "line-through opacity-70",
                  )}
                >
                  {chapter.title}
                </span>
              </div>

              {/* Duration indicator (placeholder) */}
              {isCompleted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-0.5 rounded-full"
                >
                  ✓
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

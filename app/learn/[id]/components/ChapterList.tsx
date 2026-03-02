"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
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
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-3 space-y-1"
    >
      <AnimatePresence mode="popLayout">
        {chapters.map((chapter, index) => {
          const isCompleted = completedChapters.has(chapter.id);
          const isCurrent = index === currentChapterIndex;

          return (
            <motion.button
              key={chapter.id}
              variants={itemVariants}
              layout
              type="button"
              onClick={() => setCurrentChapterIndex(index)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                isCurrent
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {/* Number or check mark */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors",
                  isCompleted
                    ? "bg-zinc-900 text-white"
                    : isCurrent
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500",
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>

              {/* Title */}
              <span className={cn("flex-1 text-sm truncate", isCurrent && "font-medium")}>
                {chapter.title}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

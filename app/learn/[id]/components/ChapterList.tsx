"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

export function ChapterList() {
  const chapters = useLearnStore((s) => s.chapters);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const currentSectionIndex = useLearnStore((s) => s.currentSectionIndex);
  const completedSections = useLearnStore((s) => s.completedSections);
  const expandedChapters = useLearnStore((s) => s.expandedChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const toggleChapterExpanded = useLearnStore((s) => s.toggleChapterExpanded);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <Circle className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">暂无章节内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {chapters.map((chapter, chIdx) => {
        const isExpanded = expandedChapters.has(chIdx);
        const isCurrent = chIdx === currentChapterIndex;
        const chapterSectionCount = chapter.sections.length;
        const chapterCompletedCount = chapter.sections.filter((sec) =>
          completedSections.has(sec.nodeId),
        ).length;
        const isChapterComplete = chapterCompletedCount === chapterSectionCount;

        return (
          <div key={`ch-${chIdx}`}>
            {/* Chapter header */}
            <button
              type="button"
              onClick={() => {
                toggleChapterExpanded(chIdx);
                if (chIdx !== currentChapterIndex) {
                  setCurrentChapterIndex(chIdx);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                isCurrent
                  ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  : "text-zinc-700 hover:bg-zinc-50",
              )}
            >
              {/* Expand/collapse icon */}
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>

              {/* Chapter number */}
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                  isChapterComplete
                    ? "bg-[var(--color-accent)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-zinc-100 text-zinc-500",
                )}
              >
                {isChapterComplete ? <Check className="w-3.5 h-3.5" /> : chIdx + 1}
              </span>

              {/* Title + progress */}
              <div className="flex-1 min-w-0">
                <span className={cn("block text-sm truncate", isCurrent && "font-semibold")}>
                  {chapter.title}
                </span>
                <span className="text-xs text-zinc-400">
                  {chapterCompletedCount}/{chapterSectionCount} 节
                </span>
              </div>
            </button>

            {/* Section list (expandable) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-7 pr-2 py-1 space-y-0.5">
                    {chapter.sections.map((sec, secIdx) => {
                      const isCompleted = completedSections.has(sec.nodeId);
                      const isCurrentSection =
                        isCurrent && secIdx === currentSectionIndex;

                      return (
                        <button
                          key={sec.nodeId}
                          type="button"
                          onClick={() => {
                            if (chIdx !== currentChapterIndex) {
                              setCurrentChapterIndex(chIdx);
                            }
                            // Scroll to section anchor
                            const el = document.getElementById(sec.nodeId);
                            el?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
                            isCurrentSection
                              ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-medium"
                              : "text-zinc-600 hover:bg-zinc-50",
                          )}
                        >
                          {/* Status dot */}
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              isCompleted
                                ? "bg-[var(--color-accent)]"
                                : "border border-zinc-300",
                            )}
                          />
                          <span className="truncate">{sec.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

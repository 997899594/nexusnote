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
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-tertiary)]">
        <Circle className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-xs">暂无章节内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {chapters.map((chapter, chIdx) => {
        const isExpanded = expandedChapters.has(chIdx);
        const isCurrent = chIdx === currentChapterIndex;
        const chapterSectionCount = chapter.sections.length;
        const chapterCompletedCount = chapter.sections.filter((sec) =>
          completedSections.has(sec.nodeId),
        ).length;
        const isChapterComplete = chapterCompletedCount === chapterSectionCount;

        return (
          <div key={chapter.title}>
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
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group",
                isCurrent
                  ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
              )}
            >
              {/* Chapter number badge */}
              <span
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  isChapterComplete
                    ? "bg-[var(--color-accent)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
                )}
              >
                {isChapterComplete ? <Check className="w-3.5 h-3.5" /> : chIdx + 1}
              </span>

              {/* Title + progress */}
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block text-[0.8125rem] truncate leading-snug",
                    isCurrent ? "font-semibold" : "font-medium",
                  )}
                >
                  {chapter.title}
                </span>
                <span
                  className={cn(
                    "text-[0.6875rem] mt-0.5 block",
                    isCurrent ? "text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)]",
                  )}
                >
                  {chapterCompletedCount}/{chapterSectionCount} 节
                </span>
              </div>

              {/* Expand/collapse icon */}
              <span
                className={cn(
                  "w-5 h-5 shrink-0 flex items-center justify-center rounded transition-colors",
                  "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]",
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            {/* Section list (expandable) with timeline */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-3 pr-2 py-1.5">
                    <div className="space-y-0.5">
                      {chapter.sections.map((sec, secIdx) => {
                        const isCompleted = completedSections.has(sec.nodeId);
                        const isCurrentSection = isCurrent && secIdx === currentSectionIndex;

                        return (
                          <button
                            key={sec.nodeId}
                            type="button"
                            onClick={() => {
                              if (chIdx !== currentChapterIndex) {
                                setCurrentChapterIndex(chIdx);
                              }
                              const el = document.getElementById(sec.nodeId);
                              el?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[0.8125rem] transition-all duration-150",
                              isCurrentSection
                                ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                            )}
                          >
                            <span className="truncate">{sec.title}</span>
                            {isCompleted && (
                              <Check className="w-3 h-3 text-[var(--color-accent)] shrink-0 ml-auto" />
                            )}
                          </button>
                        );
                      })}
                    </div>
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

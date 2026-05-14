"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

export function ChapterList() {
  const chapters = useLearnStore((s) => s.chapters);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const currentSectionIndex = useLearnStore((s) => s.currentSectionIndex);
  const completedSections = useLearnStore((s) => s.completedSections);
  const expandedChapters = useLearnStore((s) => s.expandedChapters);
  const requestedSectionId = useLearnStore((s) => s.requestedSectionId);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const setCurrentSectionIndex = useLearnStore((s) => s.setCurrentSectionIndex);
  const requestSectionFocus = useLearnStore((s) => s.requestSectionFocus);
  const toggleChapterExpanded = useLearnStore((s) => s.toggleChapterExpanded);
  const setSidebarOpen = useLearnStore((s) => s.setSidebarOpen);

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-tertiary)]">
        <Circle className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-xs">暂无章节内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {chapters.map((chapter, chIdx) => {
        const isExpanded = expandedChapters.has(chIdx);
        const isCurrent = chIdx === currentChapterIndex;
        const chapterCompletedCount = chapter.sections.filter((sec) =>
          completedSections.has(sec.nodeId),
        ).length;
        const isChapterComplete =
          chapter.sections.length > 0 && chapterCompletedCount === chapter.sections.length;
        return (
          <div key={chapter.title}>
            <button
              type="button"
              onClick={() => {
                toggleChapterExpanded(chIdx);
                if (chIdx !== currentChapterIndex) {
                  setCurrentChapterIndex(chIdx);
                }
              }}
              className={cn(
                "group w-full rounded-2xl border px-3 py-2.5 text-left transition-all duration-200",
                isCurrent
                  ? "border-black/8 bg-white text-[var(--color-text)] shadow-[0_12px_34px_-28px_rgba(15,23,42,0.35)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full transition-colors",
                    isCurrent
                      ? "bg-[var(--color-text)]"
                      : isChapterComplete
                        ? "bg-[var(--color-text-muted)]"
                        : "bg-black/10",
                  )}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-[0.84rem] leading-snug",
                      isCurrent ? "font-semibold" : "font-medium",
                    )}
                  >
                    {chapter.title}
                  </div>
                </div>

                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    "text-[var(--color-text-tertiary)] group-hover:bg-white group-hover:text-[var(--color-text-secondary)]",
                  )}
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      !isExpanded && "-rotate-90",
                    )}
                  />
                </span>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="py-1 pl-9">
                    <div className="space-y-0.5">
                      {chapter.sections.map((sec, secIdx) => {
                        const isCompleted = completedSections.has(sec.nodeId);
                        const isCurrentSection = isCurrent && secIdx === currentSectionIndex;
                        const isRequestedSection = requestedSectionId === sec.nodeId;

                        return (
                          <div key={sec.nodeId}>
                            <button
                              type="button"
                              onClick={() => {
                                if (chIdx !== currentChapterIndex) {
                                  setCurrentChapterIndex(chIdx);
                                }
                                setCurrentSectionIndex(secIdx);
                                requestSectionFocus(sec.nodeId);
                                setSidebarOpen(false);
                              }}
                              className={cn(
                                "w-full rounded-xl px-3 py-2 text-left text-[0.8125rem] transition-colors",
                                isCurrentSection || isRequestedSection
                                  ? "bg-[var(--color-panel-soft)] text-[var(--color-text)]"
                                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    isCurrentSection || isRequestedSection
                                      ? "bg-[var(--color-text)]"
                                      : isCompleted
                                        ? "bg-[var(--color-text-muted)]"
                                        : "bg-black/10",
                                  )}
                                  aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{sec.title}</span>
                                </div>
                              </div>
                            </button>
                          </div>
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

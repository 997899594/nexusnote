"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { stripSectionNumber } from "@/lib/learning/content-formatting";
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
  const setExpandedChapterOnly = useLearnStore((s) => s.setExpandedChapterOnly);
  const setSidebarOpen = useLearnStore((s) => s.setSidebarOpen);

  if (chapters.length === 0) {
    return (
      <div className="px-2 py-10 text-sm leading-6 text-[var(--color-text-tertiary)]">
        <p>暂无章节内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
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
                setExpandedChapterOnly(chIdx);
                if (chIdx !== currentChapterIndex) {
                  setCurrentChapterIndex(chIdx);
                }
              }}
              className={cn(
                "group w-full rounded-2xl px-2.5 py-2.5 text-left transition-colors duration-200",
                isCurrent
                  ? "bg-[var(--color-panel-soft)] text-[var(--color-text)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
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
                      "line-clamp-2 text-[0.84rem] leading-snug",
                      isCurrent ? "font-semibold" : "font-medium",
                    )}
                  >
                    {stripSectionNumber(chapter.title)}
                  </div>
                  <div className="mt-1 text-[0.625rem] leading-none text-[var(--color-text-muted)]">
                    {chapter.sections.length} 节
                  </div>
                </div>

                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                    "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]",
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
                  <div className="ml-[1.1rem] border-l border-black/[0.06] py-1 pl-3">
                    <div className="space-y-px">
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
                                "relative w-full rounded-xl px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
                                isCurrentSection || isRequestedSection
                                  ? "bg-white text-[var(--color-text)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
                                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="absolute -left-3 top-1/2 h-px w-2 bg-black/[0.08]"
                                  aria-hidden="true"
                                />
                                <span
                                  className={cn(
                                    "h-1 w-1 shrink-0 rounded-full",
                                    isCurrentSection || isRequestedSection
                                      ? "bg-[var(--color-text)]"
                                      : isCompleted
                                        ? "bg-[var(--color-text-muted)]"
                                        : "bg-black/10",
                                  )}
                                  aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {stripSectionNumber(sec.title)}
                                  </span>
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

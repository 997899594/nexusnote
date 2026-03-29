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
                "group w-full rounded-2xl px-3 py-3 text-left transition-all duration-200",
                isCurrent
                  ? "bg-[#eef1f5] text-[#111827] shadow-[inset_0_0_0_1px_rgba(17,24,39,0.04)]"
                  : "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors",
                    isChapterComplete
                      ? "bg-[#111827] text-white"
                      : isCurrent
                        ? "bg-[#111827] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
                  )}
                >
                  {isChapterComplete ? <Check className="h-3.5 w-3.5" /> : chIdx + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={cn(
                          "block text-[0.84rem] leading-snug",
                          isCurrent ? "font-semibold" : "font-medium",
                        )}
                      >
                        {chapter.title}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-[0.6875rem]",
                          isCurrent ? "text-[#111827]" : "text-[var(--color-text-tertiary)]",
                        )}
                      >
                        {isCurrent
                          ? `当前定位 ${Math.min(currentSectionIndex + 1, chapterSectionCount)}/${chapterSectionCount}`
                          : `${chapterCompletedCount}/${chapterSectionCount} 节`}
                      </span>
                    </div>

                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                        "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]",
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 rounded-full bg-black/[0.05]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isCurrent || isChapterComplete ? "bg-[#111827]" : "bg-black/20",
                      )}
                      style={{
                        width: `${chapterSectionCount === 0 ? 0 : (chapterCompletedCount / chapterSectionCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
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
                  <div className="px-2 pb-1.5 pt-2">
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                        本章小节
                      </span>
                      <span className="text-[0.625rem] text-[var(--color-text-tertiary)]">
                        {chapterSectionCount} 节
                      </span>
                    </div>
                    <div className="space-y-1">
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
                              setSidebarOpen(false);
                            }}
                            className={cn(
                              "w-full rounded-xl px-3 py-2.5 text-left text-[0.8125rem] transition-all duration-150",
                              isCurrentSection
                                ? "bg-[#eef1f5] text-[#111827] font-medium"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                                  isCompleted
                                    ? "border-[#111827] bg-[#111827] text-white"
                                    : isCurrentSection
                                      ? "border-[#111827] bg-white text-[#111827]"
                                      : "border-black/10 bg-white text-transparent",
                                )}
                              >
                                {isCompleted ? <Check className="h-3 w-3" /> : secIdx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate">{sec.title}</div>
                                <div className="mt-0.5 text-[0.625rem] text-[var(--color-text-tertiary)]">
                                  {isCurrentSection
                                    ? "当前阅读"
                                    : isCompleted
                                      ? "已完成"
                                      : "点击跳转"}
                                </div>
                              </div>
                            </div>
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

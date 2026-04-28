"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Circle, Dot, PlayCircle } from "lucide-react";
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
    <div className="space-y-3">
      {chapters.map((chapter, chIdx) => {
        const isExpanded = expandedChapters.has(chIdx);
        const isCurrent = chIdx === currentChapterIndex;
        const isPassed = chIdx < currentChapterIndex;
        const chapterSectionCount = chapter.sections.length;
        const chapterCompletedCount = chapter.sections.filter((sec) =>
          completedSections.has(sec.nodeId),
        ).length;
        const isChapterComplete = chapterCompletedCount === chapterSectionCount;
        const chapterProgress =
          chapterSectionCount === 0 ? 0 : (chapterCompletedCount / chapterSectionCount) * 100;
        return (
          <div key={chapter.title} className="relative pl-7">
            <div
              aria-hidden="true"
              className={cn(
                "absolute left-[14px] top-0 bottom-0 w-px",
                isCurrent
                  ? "bg-[linear-gradient(180deg,rgba(17,24,39,0.08),rgba(17,24,39,0.5),rgba(17,24,39,0.14))]"
                  : isPassed || isChapterComplete
                    ? "bg-[linear-gradient(180deg,rgba(17,24,39,0.08),rgba(17,24,39,0.24),rgba(17,24,39,0.08))]"
                    : "bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.1),rgba(15,23,42,0.02))]",
              )}
            />
            <div
              aria-hidden="true"
              className={cn(
                "absolute left-[8px] top-6 h-3.5 w-3.5 rounded-full border shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)] transition-all",
                isCurrent
                  ? "border-[var(--color-panel-strong)] bg-[var(--color-panel-strong)] ring-4 ring-black/[0.08]"
                  : isChapterComplete
                    ? "border-[var(--color-panel-strong)] bg-[var(--color-panel-strong)]"
                    : isPassed
                      ? "border-[var(--color-text-secondary)]/30 bg-[var(--color-text-secondary)]"
                      : "border-black/10 bg-white",
              )}
            />
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
                "group relative w-full rounded-[24px] border px-3 py-3 text-left transition-all duration-200",
                isCurrent
                  ? "ui-message-card border-black/8 text-[var(--color-text)]"
                  : "border-transparent bg-[var(--color-panel-soft)] text-[var(--color-text)] hover:border-black/5 hover:bg-[var(--color-hover)]",
              )}
            >
              {isCurrent ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-full bg-[linear-gradient(180deg,var(--color-panel-strong)_0%,rgba(17,24,39,0.55)_100%)]"
                />
              ) : null}
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-xs font-bold transition-colors",
                    isChapterComplete
                      ? "ui-primary-button"
                      : isCurrent
                        ? "ui-primary-button"
                        : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
                  )}
                >
                  {isChapterComplete ? <Check className="h-3.5 w-3.5" /> : chIdx + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="mb-1 block text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        Chapter {chIdx + 1}
                      </span>
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
                          isCurrent
                            ? "text-[var(--color-text)]"
                            : "text-[var(--color-text-tertiary)]",
                        )}
                      >
                        {isCurrent
                          ? `当前定位 ${Math.min(currentSectionIndex + 1, chapterSectionCount)}/${chapterSectionCount}`
                          : `${chapterCompletedCount}/${chapterSectionCount} 节`}
                      </span>
                    </div>

                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/80 transition-colors",
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

                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[var(--color-active)]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isCurrent
                            ? "bg-[linear-gradient(90deg,var(--color-panel-strong)_0%,rgba(17,24,39,0.72)_100%)]"
                            : isChapterComplete
                              ? "bg-[var(--color-panel-strong)]"
                              : "bg-[var(--color-text-muted)]",
                        )}
                        style={{
                          width: `${chapterProgress}%`,
                        }}
                      />
                    </div>
                    <span className="text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">
                      {Math.round(chapterProgress)}%
                    </span>
                  </div>
                </div>
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
                  <div className="relative px-2 pb-1 pt-2">
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-0 left-[10px] top-2 w-px",
                        isCurrent
                          ? "bg-[linear-gradient(180deg,rgba(17,24,39,0.3),rgba(17,24,39,0.06))]"
                          : "bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.03))]",
                      )}
                    />
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                        本章小节
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[0.625rem] text-[var(--color-text-tertiary)]">
                          {chapterSectionCount} 节
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {chapter.sections.map((sec, secIdx) => {
                        const isCompleted = completedSections.has(sec.nodeId);
                        const isCurrentSection = isCurrent && secIdx === currentSectionIndex;
                        const isRequestedSection = requestedSectionId === sec.nodeId;

                        return (
                          <div key={sec.nodeId} className="relative pl-5">
                            <div
                              aria-hidden="true"
                              className={cn(
                                "absolute left-[8px] top-0 h-full w-px",
                                isCurrentSection || isRequestedSection
                                  ? "bg-[linear-gradient(180deg,rgba(17,24,39,0.28),rgba(17,24,39,0.05))]"
                                  : "bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.02))]",
                              )}
                            />
                            <div
                              aria-hidden="true"
                              className={cn(
                                "absolute left-[2px] top-4 h-3 w-3 rounded-full border",
                                isCompleted
                                  ? "border-[var(--color-panel-strong)] bg-[var(--color-panel-strong)]"
                                  : isCurrentSection || isRequestedSection
                                    ? "border-[var(--color-panel-strong)] bg-[var(--color-panel-strong)] ring-4 ring-black/[0.08]"
                                    : "border-black/10 bg-white",
                              )}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (chIdx !== currentChapterIndex) {
                                  setCurrentChapterIndex(chIdx);
                                }
                                requestSectionFocus(sec.nodeId);
                                setSidebarOpen(false);
                              }}
                              className={cn(
                                "w-full rounded-[18px] border px-3 py-2.5 text-left text-[0.8125rem] transition-all duration-150",
                                isCurrentSection || isRequestedSection
                                  ? "ui-message-card border-black/8 text-[var(--color-text)]"
                                  : "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-black/5 hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                                    isCompleted
                                      ? "border-[var(--color-panel-strong)] bg-[var(--color-panel-strong)] text-white"
                                      : isCurrentSection || isRequestedSection
                                        ? "border-black/12 bg-white text-[var(--color-text)]"
                                        : "border-black/10 bg-white text-[var(--color-text-tertiary)]",
                                  )}
                                >
                                  {isCompleted ? <Check className="h-3 w-3" /> : secIdx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{sec.title}</div>
                                  <div className="mt-0.5 flex items-center gap-1 text-[0.625rem] text-[var(--color-text-tertiary)]">
                                    {isRequestedSection ? (
                                      <>
                                        <PlayCircle className="h-3 w-3" />
                                        <span>正在定位</span>
                                      </>
                                    ) : isCurrentSection ? (
                                      <>
                                        <PlayCircle className="h-3 w-3" />
                                        <span>当前阅读</span>
                                      </>
                                    ) : isCompleted ? (
                                      <>
                                        <Check className="h-3 w-3" />
                                        <span>已完成</span>
                                      </>
                                    ) : (
                                      <>
                                        <Dot className="h-3 w-3" />
                                        <span>点击跳转</span>
                                      </>
                                    )}
                                  </div>
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

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Circle, Dot, PlayCircle } from "lucide-react";
import type { GoldenPathCourseContext } from "@/lib/golden-path/types";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { getGoldenPathSkillClassName, getGoldenPathSkillStateLabel } from "./golden-path-skill-ui";

interface ChapterListProps {
  goldenPathContext?: GoldenPathCourseContext | null;
}

export function ChapterList({ goldenPathContext }: ChapterListProps) {
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

  const chapterSkillMap = new Map(
    (goldenPathContext?.chapters ?? []).map((chapter) => [
      chapter.chapterIndex,
      chapter.matchedSkills,
    ]),
  );

  return (
    <div className="space-y-2">
      {chapters.map((chapter, chIdx) => {
        const isExpanded = expandedChapters.has(chIdx);
        const isCurrent = chIdx === currentChapterIndex;
        const chapterSkills = chapterSkillMap.get(chIdx + 1) ?? [];
        const previewSkills = chapterSkills.slice(0, isCurrent ? 3 : 2);
        const chapterSectionCount = chapter.sections.length;
        const chapterCompletedCount = chapter.sections.filter((sec) =>
          completedSections.has(sec.nodeId),
        ).length;
        const isChapterComplete = chapterCompletedCount === chapterSectionCount;
        const chapterProgress =
          chapterSectionCount === 0 ? 0 : (chapterCompletedCount / chapterSectionCount) * 100;

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
                "group w-full rounded-[24px] border px-3 py-3 text-left transition-all duration-200",
                isCurrent
                  ? "border-black/8 bg-white text-[#111827] shadow-[0_18px_42px_-34px_rgba(15,23,42,0.18)]"
                  : "border-transparent bg-[#f1f3f6] text-[var(--color-text)] hover:border-black/5 hover:bg-[var(--color-hover)]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] text-xs font-bold transition-colors",
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
                          isCurrent ? "text-[#111827]" : "text-[var(--color-text-tertiary)]",
                        )}
                      >
                        {isCurrent
                          ? `当前定位 ${Math.min(currentSectionIndex + 1, chapterSectionCount)}/${chapterSectionCount}`
                          : `${chapterCompletedCount}/${chapterSectionCount} 节`}
                      </span>

                      {previewSkills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {previewSkills.map((skill) => (
                            <span
                              key={`${chapter.title}-${skill.id}`}
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-medium",
                                getGoldenPathSkillClassName(skill.state),
                              )}
                            >
                              {skill.name}
                            </span>
                          ))}
                          {chapterSkills.length > previewSkills.length && (
                            <span className="inline-flex items-center rounded-full border border-black/8 bg-white/75 px-2 py-0.5 text-[0.625rem] text-[var(--color-text-tertiary)]">
                              +{chapterSkills.length - previewSkills.length}
                            </span>
                          )}
                        </div>
                      )}
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
                    <div className="h-1.5 flex-1 rounded-full bg-black/[0.05]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isCurrent || isChapterComplete ? "bg-[#111827]" : "bg-black/20",
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
                  <div className="px-2 pb-1 pt-2">
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                        本章小节
                      </span>
                      <div className="flex items-center gap-2">
                        {chapterSkills.length > 0 && (
                          <span className="rounded-full border border-black/8 bg-white px-2 py-0.5 text-[0.625rem] text-[var(--color-text-secondary)]">
                            {chapterSkills.length} 个技能点
                          </span>
                        )}
                        <span className="text-[0.625rem] text-[var(--color-text-tertiary)]">
                          {chapterSectionCount} 节
                        </span>
                      </div>
                    </div>

                    {chapterSkills.length > 0 && (
                      <div className="mb-3 rounded-[18px] border border-black/6 bg-white/85 px-3 py-3">
                        <div className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                          本章推进技能
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {chapterSkills.slice(0, 5).map((skill) => (
                            <div
                              key={`${chapter.title}-${skill.id}-detail`}
                              className="rounded-2xl border border-black/6 bg-[#fafaf9] px-2.5 py-2"
                            >
                              <div className="text-[0.7rem] font-medium text-[var(--color-text)]">
                                {skill.name}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.625rem] font-medium",
                                    getGoldenPathSkillClassName(skill.state),
                                  )}
                                >
                                  {getGoldenPathSkillStateLabel(skill.state)}
                                </span>
                                <span className="text-[0.625rem] text-[var(--color-text-tertiary)]">
                                  {skill.progressScore}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {chapter.sections.map((sec, secIdx) => {
                        const isCompleted = completedSections.has(sec.nodeId);
                        const isCurrentSection = isCurrent && secIdx === currentSectionIndex;
                        const isRequestedSection = requestedSectionId === sec.nodeId;

                        return (
                          <button
                            key={sec.nodeId}
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
                                ? "border-black/8 bg-white text-[#111827] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]"
                                : "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-black/5 hover:bg-white/70 hover:text-[var(--color-text)]",
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                                  isCompleted
                                    ? "border-[#111827] bg-[#111827] text-white"
                                    : isCurrentSection
                                      ? "border-[#111827] bg-white text-[#111827]"
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

"use client";

import { BookOpen, Loader2, Play } from "lucide-react";
import type { ReactNode } from "react";
import { InterviewOptions, type Option } from "@/components/interview/InterviewOptions";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
import { useStartCourseFromOutline } from "@/hooks/useStartCourseFromOutline";
import type { OutlineDisplay } from "@/lib/ai/interview/models";
import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import type { ResearchEvidenceSnapshot } from "@/lib/ai/research/evidence-snapshot";
import { cn } from "@/lib/utils";

interface OutlinePanelProps {
  outline: OutlineDisplay | null;
  stableOutline: InterviewOutline | null;
  researchEvidence?: ResearchEvidenceSnapshot | null;
  actionOptions?: Option[];
  isLoading?: boolean;
  courseId?: string;
  onSelectAction?: (action: Option) => void;
  showHeader?: boolean;
  headerAction?: ReactNode;
  className?: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

function getDifficultyLabel(difficulty?: string | null) {
  if (!difficulty) {
    return "整理中";
  }

  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}

export function OutlinePanel({
  outline,
  stableOutline,
  researchEvidence,
  actionOptions = [],
  isLoading,
  courseId,
  onSelectAction,
  showHeader = true,
  headerAction,
  className,
}: OutlinePanelProps) {
  const { canStartLearning, isStarting, startStatus, startCourse } = useStartCourseFromOutline({
    outline: stableOutline,
    courseId,
  });
  const visibleActions = actionOptions.filter((action) => action.intent !== "start_course");
  const canUseStartButton = canStartLearning && !isLoading;

  const handleStartLearning = async () => {
    await startCourse();
  };

  const handleSelectAction = (action: Option) => {
    if (action.intent === "start_course") {
      void handleStartLearning();
      return;
    }

    onSelectAction?.(action);
  };

  return (
    <div className={cn("ui-page-shell flex h-full flex-col", className)}>
      {/* Header */}
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
              <BookOpen className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">蓝图</h2>
          </div>
          {headerAction}
        </div>
      ) : null}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {!outline && isLoading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-[var(--color-text-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            生成蓝图
          </div>
        ) : !outline ? (
          <div className="mt-10 text-center text-sm text-[var(--color-text-tertiary)]">
            暂无蓝图
          </div>
        ) : (
          <div className="space-y-5">
            {/* Course Title & Description */}
            <div className="space-y-3">
              <h3 className="text-xl font-semibold leading-tight tracking-[-0.04em] text-[var(--color-text)]">
                {outline.title}
              </h3>
              {outline.description ? (
                <p className="line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {outline.description}
                </p>
              ) : (
                <div className="h-5 w-full animate-pulse rounded bg-[var(--color-active)]" />
              )}
              <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1">
                  {getDifficultyLabel(outline.difficulty)}
                </span>
                <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1">
                  {outline.chapters.length} 章
                </span>
              </div>
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>更新中</span>
                </div>
              )}
              {(outline.researchCitations?.length ?? 0) > 0 ? (
                <ResearchSourceStrip
                  sources={outline.researchCitations}
                  label={`引用 ${outline.researchCitations?.length ?? 0}`}
                  meta={[
                    researchEvidence?.freshnessWindowDays
                      ? `${researchEvidence.freshnessWindowDays} 天`
                      : null,
                  ]}
                  maxVisible={4}
                />
              ) : null}
              {visibleActions.length > 0 ? (
                <div className="rounded-2xl bg-[var(--color-panel-soft)] p-3">
                  <InterviewOptions
                    options={visibleActions}
                    onSelect={handleSelectAction}
                    isStreaming={isLoading || isStarting}
                  />
                </div>
              ) : null}
            </div>

            {/* Chapters */}
            <div className="space-y-3">
              {outline.chapters.map((chapter, index) => (
                <div key={`${chapter.title}-${index}`} className="ui-message-card rounded-xl p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel-soft)] text-xs font-semibold text-[var(--color-text-secondary)]",
                      )}
                    >
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[var(--color-text)]">
                        {chapter.title}
                      </h4>
                      {chapter.sections && chapter.sections.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {chapter.sections.map((section, secIndex) => (
                            <div
                              key={`${section.title}-${secIndex}`}
                              className="flex items-center gap-2 text-xs leading-5 text-[var(--color-text-secondary)]"
                            >
                              <span className="h-1 w-1 shrink-0 rounded-full bg-black/20" />
                              <span className="line-clamp-1">{section.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {chapter.practiceType && chapter.practiceType !== "none" && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                          <span className="rounded-full bg-[var(--color-active)] px-2 py-0.5 text-[var(--color-text-secondary)]">
                            {chapter.practiceType === "exercise"
                              ? "练习"
                              : chapter.practiceType === "project"
                                ? "项目"
                                : "测验"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Start Learning Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleStartLearning}
                disabled={isStarting || !canUseStartButton}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3",
                  "ui-primary-button",
                  "font-medium text-sm",
                  "transition-colors duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>
                  {isStarting
                    ? startStatus || "生成中"
                    : canUseStartButton
                      ? "生成课程并开始学习"
                      : isLoading
                        ? stableOutline
                          ? "更新中"
                          : "生成中"
                        : "等待蓝图"}
                </span>
              </button>
              {startStatus ? (
                <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">{startStatus}</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

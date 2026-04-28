"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkspaceEmptyState } from "@/components/common";
import { InterviewOptions } from "@/components/interview/InterviewOptions";
import { useToast } from "@/components/ui/Toast";
import type { OutlineDisplay } from "@/lib/ai/interview/models";
import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import { cn } from "@/lib/utils";

interface OutlinePanelProps {
  outline: OutlineDisplay | null;
  stableOutline: InterviewOutline | null;
  actionOptions?: string[];
  isLoading?: boolean;
  courseId?: string;
  onCourseCreated: (courseId: string) => void;
  onSelectAction?: (action: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

const SKILL_LABELS: Record<string, string> = {
  "api-integration": "API 接口集成",
  "asynchronous-programming": "异步数据流",
  "ci-cd-basics": "自动化部署基础",
  "css-in-react": "组件样式工程",
  deployment: "部署上线",
  jsx: "JSX 与组件表达",
  "performance-optimization": "性能优化",
  "project-architecture": "项目架构",
  "react-fundamentals": "React 核心基础",
  "react-hooks": "React Hooks",
  "react-performance": "React 性能优化",
  "react-router": "React Router",
  "spa-architecture": "单页应用架构",
  "ui-design-patterns": "UI 设计模式",
};

function getDifficultyLabel(difficulty?: string | null) {
  if (!difficulty) {
    return "整理中";
  }

  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}

function getSkillLabel(skillId: string) {
  return (
    SKILL_LABELS[skillId] ??
    skillId
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function OutlinePanel({
  outline,
  stableOutline,
  actionOptions = [],
  isLoading,
  courseId,
  onCourseCreated,
  onSelectAction,
}: OutlinePanelProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const { addToast } = useToast();
  const canStartLearning = Boolean(stableOutline);

  const handleStartLearning = async () => {
    setIsStarting(true);
    try {
      if (!stableOutline) {
        return;
      }

      const response = await fetch("/api/interview/create-course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outline: stableOutline,
          courseId,
        }),
      });

      if (!response.ok) {
        throw new Error("课程生成失败");
      }

      const data = (await response.json()) as { courseId?: string };
      if (!data.courseId) {
        throw new Error("课程生成失败");
      }

      onCourseCreated(data.courseId);
      router.push(`/learn/${data.courseId}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "课程生成失败", "error");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="ui-page-shell flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pb-4 pt-5">
        <div className="ui-primary-button flex h-9 w-9 items-center justify-center rounded-xl">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-base font-semibold text-[var(--color-text)]">学习大纲</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {!outline && isLoading ? (
            <WorkspaceEmptyState
              title="正在生成课程大纲"
              description="我在整理课程目标、章节结构和学习成果，马上给你一版可预览的大纲。"
              eyebrow="Outline"
              loading
              className="mt-10"
            />
          ) : !outline ? (
            <WorkspaceEmptyState
              icon={BookOpen}
              eyebrow="Outline"
              title="暂无学习大纲"
              description="开始对话后，我会根据你的目标生成一版个性化课程大纲。"
              className="mt-10"
            />
          ) : (
            <motion.div
              key="content"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {/* Course Title & Description */}
              <motion.div variants={itemVariants} className="space-y-2">
                <h3 className="text-lg font-bold text-[var(--color-text)]">{outline.title}</h3>
                {outline.description ? (
                  <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                    {outline.description}
                  </p>
                ) : (
                  <div className="h-5 w-full animate-pulse rounded bg-[var(--color-active)]" />
                )}
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  难度：{getDifficultyLabel(outline.difficulty)}
                </p>
                <div className="ui-message-card rounded-2xl p-3 text-xs text-[var(--color-text-secondary)]">
                  <p>
                    <span className="font-semibold text-[var(--color-text)]">适合人群：</span>
                    {outline.targetAudience ?? "正在补充适合人群..."}
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-[var(--color-text)]">完成后你将获得：</span>
                    {outline.learningOutcome ?? "正在补充学习成果..."}
                  </p>
                  {outline.courseSkillIds && outline.courseSkillIds.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-semibold text-[var(--color-text)]">核心能力：</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {outline.courseSkillIds.map((skillId) => (
                          <span
                            key={skillId}
                            className="ui-primary-button rounded-full px-2.5 py-1 text-[11px]"
                          >
                            {getSkillLabel(skillId)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>正在补全章节说明与细节...</span>
                  </div>
                )}
                {actionOptions.length > 0 ? (
                  <div className="ui-control-surface rounded-2xl p-3">
                    <p className="text-xs font-medium text-[var(--color-text)]">快速调整</p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                      直接点一个方向，我会继续改这版大纲。
                    </p>
                    <InterviewOptions
                      options={actionOptions}
                      onSelect={(action) => onSelectAction?.(action)}
                      isStreaming={isLoading || isStarting}
                    />
                  </div>
                ) : null}
              </motion.div>

              {/* Chapters */}
              <div className="space-y-3">
                {outline.chapters.map((chapter, index) => (
                  <motion.div
                    key={`${chapter.title}-${index}`}
                    variants={itemVariants}
                    className="ui-message-card rounded-xl p-3 transition-all hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <div className="flex items-start gap-3">
                      {/* Chapter Number */}
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          "ui-primary-button",
                          "text-xs font-bold",
                        )}
                      >
                        {index + 1}
                      </div>

                      {/* Chapter Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-[var(--color-text)]">
                          {chapter.title}
                        </h4>
                        {chapter.description ? (
                          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                            {chapter.description}
                          </p>
                        ) : (
                          <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-[var(--color-active)]" />
                        )}
                        {chapter.sections && chapter.sections.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {chapter.sections.map((section, secIndex) => (
                              <div
                                key={`${section.title}-${secIndex}`}
                                className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 shrink-0 text-xs text-[var(--color-text-tertiary)]">
                                    {index + 1}.{secIndex + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-[var(--color-text)]">
                                      {section.title}
                                    </p>
                                    {section.description ? (
                                      <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                                        {section.description}
                                      </p>
                                    ) : (
                                      <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded bg-[var(--color-active)]" />
                                    )}
                                  </div>
                                </div>
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
                        {chapter.skillIds && chapter.skillIds.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {chapter.skillIds.map((skillId) => (
                              <span
                                key={skillId}
                                className="rounded-full bg-[var(--color-panel-soft)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]"
                              >
                                {getSkillLabel(skillId)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Start Learning Button */}
              <motion.div variants={itemVariants} className="pt-4">
                <button
                  type="button"
                  onClick={handleStartLearning}
                  disabled={isStarting || !canStartLearning}
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
                      ? "生成中..."
                      : canStartLearning
                        ? "生成课程并开始学习"
                        : isLoading
                          ? "正在生成完整大纲..."
                          : "等待完整大纲"}
                  </span>
                </button>
                {isLoading && canStartLearning ? (
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    当前正在更新预览，点击会基于上一版完整大纲生成课程。
                  </p>
                ) : null}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

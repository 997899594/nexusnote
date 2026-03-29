"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkspaceEmptyState } from "@/components/common";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { OutlineData } from "@/stores/interview";
import { useInterviewStore } from "@/stores/interview";

interface OutlinePanelProps {
  outline: OutlineData | null;
  isLoading?: boolean;
  courseId?: string;
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

export function OutlinePanel({ outline, isLoading, courseId }: OutlinePanelProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const { addToast } = useToast();
  const setCourseId = useInterviewStore((s) => s.setCourseId);

  const isOutlineReady =
    !!outline?.title &&
    !!outline.description &&
    !!outline.targetAudience &&
    !!outline.learningOutcome &&
    !!outline.difficulty &&
    outline.chapters.length >= 5 &&
    outline.chapters.every(
      (chapter) =>
        chapter.title &&
        chapter.description &&
        chapter.sections.length >= 4 &&
        chapter.sections.every((section) => section.title && section.description),
    );

  const handleStartLearning = async () => {
    setIsStarting(true);
    try {
      if (!outline || !isOutlineReady) {
        return;
      }

      const response = await fetch("/api/interview/create-course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outline,
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

      setCourseId(data.courseId);
      router.push(`/learn/${data.courseId}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "课程生成失败", "error");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-base font-semibold text-zinc-900">学习大纲</h2>
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
                <h3 className="text-lg font-bold text-zinc-900">{outline.title}</h3>
                {outline.description ? (
                  <p className="text-sm leading-6 text-zinc-600">{outline.description}</p>
                ) : (
                  <div className="h-5 w-full animate-pulse rounded bg-zinc-200/70" />
                )}
                <p className="text-xs text-zinc-500">难度: {outline.difficulty ?? "整理中"}</p>
                <div className="rounded-2xl border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-600">
                  <p>
                    <span className="font-semibold text-zinc-800">适合人群：</span>
                    {outline.targetAudience ?? "正在补充适合人群..."}
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-zinc-800">完成后你将获得：</span>
                    {outline.learningOutcome ?? "正在补充学习成果..."}
                  </p>
                </div>
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>正在补全章节说明与细节...</span>
                  </div>
                )}
              </motion.div>

              {/* Chapters */}
              <div className="space-y-3">
                {outline.chapters.map((chapter, index) => (
                  <motion.div
                    key={`${chapter.title}-${index}`}
                    variants={itemVariants}
                    className="rounded-xl bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-3 transition-all hover:shadow-[var(--shadow-card-hover)]"
                  >
                    <div className="flex items-start gap-3">
                      {/* Chapter Number */}
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          "bg-zinc-900 text-white",
                          "text-xs font-bold",
                        )}
                      >
                        {index + 1}
                      </div>

                      {/* Chapter Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-900">{chapter.title}</h4>
                        {chapter.description ? (
                          <p className="mt-1 text-xs leading-5 text-zinc-600">
                            {chapter.description}
                          </p>
                        ) : (
                          <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-zinc-200/70" />
                        )}
                        {chapter.sections && chapter.sections.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {chapter.sections.map((section, secIndex) => (
                              <div
                                key={`${section.title}-${secIndex}`}
                                className="rounded-xl bg-zinc-50 px-3 py-2"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-xs text-zinc-400 mt-0.5 shrink-0">
                                    {index + 1}.{secIndex + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-zinc-700">
                                      {section.title}
                                    </p>
                                    {section.description ? (
                                      <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                                        {section.description}
                                      </p>
                                    ) : (
                                      <div className="mt-2 h-3.5 w-4/5 animate-pulse rounded bg-zinc-200/70" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {chapter.practiceType && chapter.practiceType !== "none" && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                            <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-zinc-600">
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
                  </motion.div>
                ))}
              </div>

              {/* Start Learning Button */}
              <motion.div variants={itemVariants} className="pt-4">
                <button
                  type="button"
                  onClick={handleStartLearning}
                  disabled={isStarting || !isOutlineReady || Boolean(isLoading)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3",
                    "bg-zinc-900 text-white",
                    "font-medium text-sm",
                    "hover:bg-zinc-800",
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
                      : isLoading
                        ? "正在整理完整大纲..."
                        : "生成课程并开始学习"}
                  </span>
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Clock, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Chapter {
  title: string;
  description?: string;
  topics?: string[];
}

interface OutlineData {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  chapters: Chapter[];
}

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

  const handleStartLearning = async () => {
    if (!courseId) return;
    setIsStarting(true);
    // 跳转到课程详情页
    router.push(`/learn/${courseId}`);
  };

  return (
    <div className="flex h-full flex-col border-r border-zinc-100 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-base font-semibold text-zinc-900">学习大纲</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500"
            >
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <p className="text-sm">正在生成课程大纲...</p>
            </motion.div>
          ) : !outline ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
                <BookOpen className="h-8 w-8 text-zinc-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700">暂无学习大纲</p>
                <p className="mt-1 text-xs text-zinc-500">
                  开始对话后，AI 将为你生成个性化学习大纲
                </p>
              </div>
            </motion.div>
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
                {outline.description && (
                  <p className="text-sm text-zinc-600 leading-relaxed">{outline.description}</p>
                )}
                {outline.estimatedMinutes && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <Clock className="h-4 w-4" />
                    <span>
                      预计时长: {Math.floor(outline.estimatedMinutes / 60)}小时
                      {outline.estimatedMinutes % 60 > 0 && ` ${outline.estimatedMinutes % 60}分钟`}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Chapters */}
              <div className="space-y-3">
                {outline.chapters.map((chapter, index) => (
                  <motion.div
                    key={`${chapter.title}-${index}`}
                    variants={itemVariants}
                    className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:bg-zinc-100"
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
                        {chapter.description && (
                          <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                            {chapter.description}
                          </p>
                        )}
                        {chapter.topics && chapter.topics.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {chapter.topics.map((topic, topicIndex) => (
                              <span
                                key={`${topic}-${topicIndex}`}
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-zinc-200 text-zinc-600"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Start Learning Button */}
              {courseId && (
                <motion.div variants={itemVariants} className="pt-4">
                  <button
                    type="button"
                    onClick={handleStartLearning}
                    disabled={isStarting}
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
                    <span>{isStarting ? "准备中..." : "开始学习"}</span>
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type { OutlineData, Chapter, OutlinePanelProps };

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Clock, Loader2 } from "lucide-react";
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

export function OutlinePanel({ outline, isLoading }: OutlinePanelProps) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-base font-semibold text-foreground">学习大纲</h2>
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
              className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
            >
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm">正在生成课程大纲...</p>
            </motion.div>
          ) : !outline ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">暂无学习大纲</p>
                <p className="mt-1 text-xs">开始对话后，AI 将为你生成个性化学习大纲</p>
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
                <h3 className="text-lg font-bold text-foreground">{outline.title}</h3>
                {outline.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {outline.description}
                  </p>
                )}
                {outline.estimatedMinutes && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      预计时长: {Math.floor(outline.estimatedMinutes / 60)}小时
                      {outline.estimatedMinutes % 60 > 0 &&
                        ` ${outline.estimatedMinutes % 60}分钟`}
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
                    className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-start gap-3">
                      {/* Chapter Number */}
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          "bg-gradient-to-br from-purple-500 to-purple-600",
                          "text-xs font-bold text-white shadow-sm"
                        )}
                      >
                        {index + 1}
                      </div>

                      {/* Chapter Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">
                          {chapter.title}
                        </h4>
                        {chapter.description && (
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {chapter.description}
                          </p>
                        )}
                        {chapter.topics && chapter.topics.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {chapter.topics.map((topic, topicIndex) => (
                              <span
                                key={`${topic}-${topicIndex}`}
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                                  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type { OutlineData, Chapter, OutlinePanelProps };

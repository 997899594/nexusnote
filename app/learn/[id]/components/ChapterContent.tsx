"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { Editor } from "@/components/editor";
import { useChapterGeneration } from "@/hooks/useChapterGeneration";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

interface ChapterContentProps {
  courseId: string;
  chapterDocs: ChapterDoc[];
}

/** Parse Buffer content to string */
function parseBufferContent(content: Buffer | null): string {
  if (!content) return "";

  const bufferData = content as Buffer | { type: string; data: number[] } | string;

  if (Buffer.isBuffer(bufferData)) {
    return bufferData.toString("utf-8");
  }
  if (
    bufferData &&
    typeof bufferData === "object" &&
    "type" in bufferData &&
    (bufferData as { type: string }).type === "Buffer" &&
    "data" in bufferData
  ) {
    return Buffer.from((bufferData as { data: number[] }).data).toString("utf-8");
  }
  if (typeof bufferData === "string") {
    return bufferData;
  }
  return "";
}

function GeneratingState({ chapterTitle }: { chapterTitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-zinc-400 p-8"
    >
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
        <Loader2 className="w-10 h-10 text-[var(--color-accent)] animate-spin" />
      </div>
      <h3 className="text-lg font-medium text-zinc-600 mb-2">正在生成内容</h3>
      <p className="text-sm text-center max-w-sm">
        正在为「{chapterTitle}」生成教学内容，请稍候...
      </p>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-zinc-400 p-8"
    >
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
        <FileText className="w-10 h-10 text-zinc-300" />
      </div>
      <h3 className="text-lg font-medium text-zinc-600 mb-2">暂无内容</h3>
      <p className="text-sm text-center max-w-sm">该章节内容尚未生成。</p>
    </motion.div>
  );
}

export function ChapterContent({ courseId, chapterDocs }: ChapterContentProps) {
  const { currentChapterIndex, isZenMode, chapters, markChapterGenerated } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];

  // Match chapter doc by outlineNodeId (not by index)
  const existingContent = useMemo(() => {
    if (!currentChapter) return "";
    const nodeId = currentChapter.nodeId;
    const doc = chapterDocs.find((d) => d.outlineNodeId === nodeId);
    return parseBufferContent(doc?.content ?? null);
  }, [chapterDocs, currentChapter]);

  // Determine if we need to generate
  const needsGeneration = !existingContent && !!currentChapter;

  // Streaming generation hook
  const { streamingContent, htmlContent, isGenerating, isComplete, error } = useChapterGeneration({
    courseId,
    chapterIndex: currentChapterIndex,
    chapterTitle: currentChapter?.title ?? "",
    enabled: needsGeneration,
  });

  // Track generated chapters
  useEffect(() => {
    if (isComplete) {
      markChapterGenerated(currentChapterIndex);
    }
  }, [isComplete, currentChapterIndex, markChapterGenerated]);

  // Determine what to display
  const editorContent = existingContent || htmlContent;
  const showEditor = !!editorContent && !isGenerating;
  const showStreaming = isGenerating && streamingContent.length > 0;
  const showInitialLoading = isGenerating && streamingContent.length === 0;

  // Handle content change
  const handleContentChange = useCallback((_html: string) => {
    // Future: auto-save to documents table
  }, []);

  if (!currentChapter) {
    return <EmptyState />;
  }

  return (
    <div className="h-full overflow-auto">
      <AnimatePresence mode="wait">
        {showInitialLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <GeneratingState chapterTitle={currentChapter.title} />
          </motion.div>
        ) : showStreaming ? (
          <motion.div
            key="streaming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "h-full overflow-auto",
              isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6 md:p-8 lg:p-10",
            )}
          >
            {/* Chapter header */}
            {!isZenMode && (
              <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>第 {currentChapterIndex + 1} 章 · 生成中...</span>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900">{currentChapter.title}</h2>
              </div>
            )}

            <StreamdownMessage content={streamingContent} isStreaming={true} />
          </motion.div>
        ) : showEditor ? (
          <motion.div
            key={`editor-${currentChapterIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "h-full",
              isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6 md:p-8 lg:p-10",
            )}
          >
            {/* Chapter header */}
            {!isZenMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 pb-4 border-b border-[var(--color-border)]"
              >
                <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>第 {currentChapterIndex + 1} 章</span>
                </div>
                <h2 className="text-xl font-semibold text-zinc-900">{currentChapter.title}</h2>
              </motion.div>
            )}

            {/* Editable Editor */}
            <div className="prose prose-zinc max-w-none">
              <Editor
                content={editorContent}
                onChange={handleContentChange}
                placeholder="章节内容..."
              />
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-zinc-400 p-8"
          >
            <h3 className="text-lg font-medium text-red-600 mb-2">生成失败</h3>
            <p className="text-sm text-center max-w-sm text-zinc-500">{error}</p>
          </motion.div>
        ) : (
          <EmptyState />
        )}
      </AnimatePresence>
    </div>
  );
}

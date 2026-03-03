/**
 * LearnEditor - Chapter content display wrapper for the Editor component
 *
 * Wraps the Editor component and displays the current chapter's content
 * with support for zen mode layout and content change animations.
 *
 * 2026 UI: Enhanced loading states and smooth transitions.
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Editor } from "@/components/editor";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

interface LearnEditorProps {
  chapterDocs: ChapterDoc[];
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 bg-zinc-100 rounded-lg w-3/4 animate-pulse" />
      <div className="space-y-3">
        <div className="h-4 bg-zinc-100 rounded w-full animate-pulse" />
        <div className="h-4 bg-zinc-100 rounded w-5/6 animate-pulse" />
        <div className="h-4 bg-zinc-100 rounded w-4/6 animate-pulse" />
      </div>
      <div className="h-32 bg-zinc-100 rounded-xl animate-pulse mt-6" />
      <div className="space-y-3">
        <div className="h-4 bg-zinc-100 rounded w-full animate-pulse" />
        <div className="h-4 bg-zinc-100 rounded w-3/4 animate-pulse" />
      </div>
    </div>
  );
}

// Empty state component
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
      <p className="text-sm text-center max-w-sm">该章节内容正在生成中，或者还没有添加内容。</p>
    </motion.div>
  );
}

export function LearnEditor({ chapterDocs }: LearnEditorProps) {
  const { currentChapterIndex, isZenMode, chapters } = useLearnStore();
  const [loading, setLoading] = useState(false);
  const [editorContent, setEditorContent] = useState<string>("");

  // Find the current chapter doc from chapterDocs
  const currentChapterDoc = chapterDocs[currentChapterIndex];
  const currentChapter = chapters[currentChapterIndex];

  // Parse content Buffer to JSON string for Editor
  useEffect(() => {
    setLoading(true);

    // Simulate brief loading state when switching chapters
    const timer = setTimeout(() => {
      if (currentChapterDoc?.content) {
        // Buffer is stored as an object with type and data
        // Convert Buffer to string
        const bufferData = currentChapterDoc.content as
          | Buffer
          | { type: string; data: number[] }
          | string;
        let contentString = "";

        if (Buffer.isBuffer(bufferData)) {
          contentString = bufferData.toString("utf-8");
        } else if (
          bufferData &&
          typeof bufferData === "object" &&
          "type" in bufferData &&
          (bufferData as { type: string }).type === "Buffer" &&
          "data" in bufferData
        ) {
          // Handle serialized Buffer format
          const buffer = Buffer.from((bufferData as { data: number[] }).data);
          contentString = buffer.toString("utf-8");
        } else if (typeof bufferData === "string") {
          contentString = bufferData;
        }

        setEditorContent(contentString || "");
      } else {
        setEditorContent("");
      }
      setLoading(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [currentChapterDoc, currentChapterIndex]);

  // Handle content change - TODO: implement auto-save
  const handleContentChange = useCallback((html: string) => {
    // TODO: Implement auto-save functionality
    console.log("Content changed, auto-save pending implementation");
  }, []);

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <LoadingSkeleton />
          </motion.div>
        ) : !editorContent ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <EmptyState />
          </motion.div>
        ) : (
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
            {/* Chapter header (non-zen mode) */}
            {!isZenMode && currentChapter && (
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

            {/* Editor */}
            <div className="prose prose-zinc max-w-none">
              <Editor
                content={editorContent}
                onChange={handleContentChange}
                placeholder="章节内容..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LearnEditor;

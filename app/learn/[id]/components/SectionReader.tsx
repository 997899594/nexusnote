// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import { AlertCircle, BookOpen, Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import type { Annotation } from "@/hooks/useAnnotations";
import { useAnnotations } from "@/hooks/useAnnotations";
import type { SectionState } from "@/hooks/useChapterSections";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { AnnotationLayer } from "./AnnotationLayer";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

interface SectionDoc {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeId: string | null;
  metadata: { annotations?: Annotation[] } | null;
}

interface SectionReaderProps {
  courseId: string;
  sections: Map<number, SectionState>;
  generateSection: (index: number) => void;
  sectionDocs: SectionDoc[];
  scrollToSectionId?: string | null;
}

function NoteInputDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl p-4 w-80"
      >
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">添加笔记</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写下你的想法..."
          rows={3}
          className="w-full border border-zinc-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={!text.trim()}
            className="px-3 py-1.5 text-xs bg-zinc-900 text-white rounded-lg disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SectionBlock({
  sectionIndex,
  chapterIndex,
  sectionTitle,
  state,
  sectionDoc,
  courseId,
  generateSection,
}: {
  sectionIndex: number;
  chapterIndex: number;
  sectionTitle: string;
  state: SectionState;
  sectionDoc: SectionDoc | undefined;
  courseId: string;
  generateSection: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pendingNoteAnchor, setPendingNoteAnchor] = useState<Annotation["anchor"] | null>(null);
  const [showReadLine, setShowReadLine] = useState(false);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const completedSections = useLearnStore((s) => s.completedSections);

  const { annotations, addHighlight, addNote, removeAnnotation, updateNote } = useAnnotations({
    documentId: sectionDoc?.id,
    initialAnnotations: sectionDoc?.metadata?.annotations ?? [],
  });

  const isComplete = state.status === "complete";
  const anchorId = `section-${chapterIndex + 1}-${sectionIndex + 1}`;
  const isAlreadyRead = completedSections.has(anchorId);

  // Scroll-based completion detection: sentinel at section bottom
  useEffect(() => {
    if (!isComplete || isAlreadyRead || !sentinelRef.current) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Debounce: must stay visible for 800ms
            debounceTimer = setTimeout(() => {
              markSectionComplete(anchorId);
              setShowReadLine(true);

              // Persist to server
              fetch("/api/learn/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId, sectionNodeId: anchorId }),
              }).catch((err) => {
                console.error("[SectionReader] Failed to persist progress:", err);
              });
            }, 800);
          } else if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
        }
      },
      { threshold: 0.8 },
    );

    observer.observe(sentinelRef.current);
    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isComplete, isAlreadyRead, anchorId, courseId, markSectionComplete]);

  const handleNote = useCallback((anchor: Annotation["anchor"]) => {
    setPendingNoteAnchor(anchor);
  }, []);

  return (
    <div id={anchorId} className="relative">
      {(showReadLine || isAlreadyRead) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="absolute top-2 right-0 z-10 group"
        >
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full",
              "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]",
              "transition-all duration-200 cursor-default",
            )}
          >
            <Check className="w-3 h-3 shrink-0" />
            <span
              className={cn(
                "text-xs font-medium overflow-hidden transition-all duration-200",
                "max-w-0 opacity-0 group-hover:max-w-[4rem] group-hover:opacity-100",
              )}
            >
              已学完
            </span>
          </div>
        </motion.div>
      )}
      {/* Section spacing */}
      {sectionIndex > 0 && <div className="pt-14" />}

      {/* Section content */}
      <div ref={containerRef} className="relative">
        {state.status === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-16"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-subtle)] flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">{sectionTitle}</p>
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)] hover:shadow-md",
                "active:scale-[0.98]",
              )}
            >
              <Sparkles className="w-4 h-4" />
              生成内容
            </button>
          </motion.div>
        )}

        {state.status === "generating" && state.content.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-16 gap-3"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              正在生成「{sectionTitle}」...
            </p>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {(state.status === "generating" || state.status === "complete") && state.content && (
          <div className="learn-prose">
            <StreamdownMessage
              content={state.content}
              isStreaming={state.status === "generating"}
            />
          </div>
        )}

        {state.status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 py-5 px-5 bg-red-50 rounded-xl border border-red-100"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700">生成失败</p>
              <p className="text-xs text-red-500 mt-0.5">{state.error ?? "请稍后重试"}</p>
            </div>
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all",
                "bg-white border border-red-200 text-red-600",
                "hover:bg-red-50 hover:border-red-300",
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试
            </button>
          </motion.div>
        )}

        {/* Annotation layer — only for completed sections */}
        {isComplete && (
          <>
            <AnnotationLayer
              containerRef={containerRef}
              annotations={annotations}
              onRemove={removeAnnotation}
              onUpdateNote={updateNote}
            />
            <TextSelectionToolbar
              containerRef={containerRef}
              onHighlight={addHighlight}
              onNote={handleNote}
            />
          </>
        )}

        {/* Scroll sentinel for read-completion detection */}
        {isComplete && !isAlreadyRead && (
          <div ref={sentinelRef} className="h-4" aria-hidden="true" />
        )}
      </div>

      {/* Note input dialog */}
      {pendingNoteAnchor && (
        <NoteInputDialog
          onSubmit={(text) => {
            addNote(pendingNoteAnchor, text);
            setPendingNoteAnchor(null);
          }}
          onCancel={() => setPendingNoteAnchor(null)}
        />
      )}
    </div>
  );
}

export function SectionReader({
  courseId,
  sections,
  generateSection,
  sectionDocs,
  scrollToSectionId,
}: SectionReaderProps) {
  const { currentChapterIndex, chapters, isZenMode, setCurrentSectionIndex } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToResume = useRef(false);

  // Auto-scroll to resume section on mount
  useEffect(() => {
    if (!scrollToSectionId || hasScrolledToResume.current) return;
    // Delay to let the DOM render section anchors
    const timer = setTimeout(() => {
      const el = document.getElementById(scrollToSectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        hasScrolledToResume.current = true;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [scrollToSectionId]);

  // Intersection Observer to track visible section
  useEffect(() => {
    if (!scrollContainerRef.current || !currentChapter) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id; // "section-1-1" format
            const parts = id.split("-");
            if (parts.length === 3) {
              const secIdx = parseInt(parts[2], 10) - 1;
              if (!Number.isNaN(secIdx)) {
                setCurrentSectionIndex(secIdx);
              }
            }
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      },
    );

    // Observe all section anchors
    const sectionCount = currentChapter.sections.length;
    for (let i = 0; i < sectionCount; i++) {
      const el = document.getElementById(`section-${currentChapterIndex + 1}-${i + 1}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [currentChapterIndex, currentChapter, setCurrentSectionIndex]);

  if (!currentChapter) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <p className="text-sm">暂无内容</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto">
      <div
        className={cn(
          "max-w-3xl mx-auto",
          isZenMode ? "px-6 md:px-8 py-12" : "px-6 md:px-10 lg:px-12 py-8 md:py-10",
        )}
      >
        {/* Chapter header */}
        {!isZenMode && (
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />第 {currentChapterIndex + 1} 章
              </span>
            </div>
            <h2 className="text-2xl md:text-[1.75rem] font-bold text-[var(--color-text)] leading-tight tracking-tight">
              {currentChapter.title}
            </h2>
            {currentChapter.description && (
              <p className="mt-2.5 text-base text-[var(--color-text-secondary)] leading-relaxed">
                {currentChapter.description}
              </p>
            )}
            <div className="mt-8" />
          </div>
        )}

        {/* Sections */}
        {currentChapter.sections.map((sec, secIdx) => {
          const state = sections.get(secIdx) ?? { content: "", status: "idle" as const };
          const nodeId = sec.nodeId;
          const sectionDoc = sectionDocs.find((d) => d.outlineNodeId === nodeId);

          return (
            <SectionBlock
              key={nodeId}
              sectionIndex={secIdx}
              chapterIndex={currentChapterIndex}
              sectionTitle={sec.title}
              state={state}
              sectionDoc={sectionDoc}
              courseId={courseId}
              generateSection={generateSection}
            />
          );
        })}

        {/* Bottom spacing */}
        <div className="h-20" />
      </div>
    </div>
  );
}

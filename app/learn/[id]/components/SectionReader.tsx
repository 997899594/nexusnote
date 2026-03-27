// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import { AlertCircle, BookOpen, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { useToast } from "@/components/ui/Toast";
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
  annotations: Annotation[];
}

interface SectionReaderProps {
  courseId: string;
  sections: Map<number, SectionState>;
  generateSection: (index: number) => void;
  sectionDocs: SectionDoc[];
  scrollToSectionId?: string | null;
}

function CaptureNoteDialog({
  selectedText,
  onSubmit,
  onCancel,
}: {
  selectedText: string;
  onSubmit: (noteContent: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-[28rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-4 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]"
      >
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">沉淀到笔记</h3>
        <div className="rounded-xl bg-[#f6f7f9] px-3 py-2 text-sm leading-6 text-zinc-700">
          {selectedText}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="补充你的理解、疑问或行动项（可选）"
          rows={4}
          className="mt-3 w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSubmit(text.trim())}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white"
          >
            创建并打开
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
  const [pendingCapture, setPendingCapture] = useState<{
    anchor: Annotation["anchor"];
    selectedText: string;
  } | null>(null);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const completedSections = useLearnStore((s) => s.completedSections);
  const { addToast } = useToast();
  const router = useRouter();

  const { annotations, addHighlight, removeAnnotation, updateNote } = useAnnotations({
    sectionId: sectionDoc?.id,
    initialAnnotations: sectionDoc?.annotations ?? [],
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

  const handleCapture = useCallback(
    async (noteContent: string) => {
      if (!pendingCapture || !sectionDoc?.id) return;

      try {
        const response = await fetch("/api/notes/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: sectionDoc.id,
            selectionText: pendingCapture.selectedText,
            anchor: pendingCapture.anchor,
            noteContent: noteContent || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("创建笔记失败");
        }

        const result = (await response.json()) as {
          note?: { id: string; title: string };
        };

        addToast(`已打开笔记：${result.note?.title ?? "新笔记"}`, "success");
        setPendingCapture(null);
        if (result.note?.id) {
          router.push(`/editor/${result.note.id}`);
        }
      } catch {
        addToast("沉淀笔记失败，请稍后重试", "error");
      }
    },
    [addToast, pendingCapture, router, sectionDoc?.id],
  );

  return (
    <div id={anchorId} className="relative">
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
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef1f5]">
              <BookOpen className="h-6 w-6 text-[#111827]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">{sectionTitle}</p>
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                "bg-[#111827] text-white",
                "hover:bg-zinc-800 hover:shadow-md",
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef1f5]">
                <Loader2 className="h-5 w-5 animate-spin text-[#111827]" />
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              正在生成「{sectionTitle}」...
            </p>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-[#111827]"
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
            className="flex items-center gap-4 rounded-xl bg-[#f6f7f9] px-5 py-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)]">
              <AlertCircle className="h-5 w-5 text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-700">生成失败</p>
              <p className="mt-0.5 text-xs text-zinc-500">{state.error ?? "请稍后重试"}</p>
            </div>
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] transition-all",
                "hover:bg-[#f8fafc]",
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
              onCapture={(anchor, selectedText) => {
                setPendingCapture({ anchor, selectedText });
              }}
            />
          </>
        )}

        {/* Scroll sentinel for read-completion detection */}
        {isComplete && !isAlreadyRead && (
          <div ref={sentinelRef} className="h-4" aria-hidden="true" />
        )}
      </div>

      {/* Note input dialog */}
      {pendingCapture && (
        <CaptureNoteDialog
          selectedText={pendingCapture.selectedText}
          onSubmit={handleCapture}
          onCancel={() => setPendingCapture(null)}
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs font-semibold text-[#111827]">
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

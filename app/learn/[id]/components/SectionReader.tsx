// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
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
          autoFocus
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
  generateSection,
}: {
  sectionIndex: number;
  chapterIndex: number;
  sectionTitle: string;
  state: SectionState;
  sectionDoc: SectionDoc | undefined;
  generateSection: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingNoteAnchor, setPendingNoteAnchor] = useState<Annotation["anchor"] | null>(null);

  const { annotations, addHighlight, addNote, removeAnnotation, updateNote } = useAnnotations({
    documentId: sectionDoc?.id,
    initialAnnotations: sectionDoc?.metadata?.annotations ?? [],
  });

  const isComplete = state.status === "complete";

  const handleNote = useCallback((anchor: Annotation["anchor"]) => {
    setPendingNoteAnchor(anchor);
  }, []);

  const anchorId = `section-${chapterIndex + 1}-${sectionIndex + 1}`;

  return (
    <div id={anchorId} className="relative">
      {/* Section divider (not for first section) */}
      {sectionIndex > 0 && (
        <hr className="border-t border-zinc-100 my-8" />
      )}

      {/* Section content */}
      <div ref={containerRef} className="relative">
        {state.status === "idle" && (
          <div className="flex flex-col items-center py-12 text-zinc-400">
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-sm text-zinc-600 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              生成「{sectionTitle}」
            </button>
          </div>
        )}

        {state.status === "generating" && state.content.length === 0 && (
          <div className="flex items-center gap-2 py-8 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">正在生成「{sectionTitle}」...</span>
          </div>
        )}

        {(state.status === "generating" || state.status === "complete") && state.content && (
          <StreamdownMessage
            content={state.content}
            isStreaming={state.status === "generating"}
          />
        )}

        {state.status === "error" && (
          <div className="flex items-center gap-3 py-6 px-4 bg-red-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{state.error ?? "生成失败"}</p>
            </div>
            <button
              type="button"
              onClick={() => generateSection(sectionIndex)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-red-200 rounded-lg text-red-600 hover:bg-red-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重试
            </button>
          </div>
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
}: SectionReaderProps) {
  const { currentChapterIndex, chapters, isZenMode, setCurrentSectionIndex } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      const el = document.getElementById(
        `section-${currentChapterIndex + 1}-${i + 1}`,
      );
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [currentChapterIndex, currentChapter, setCurrentSectionIndex]);

  // Scroll to section triggered from sidebar
  const scrollToSection = useCallback((sectionIndex: number) => {
    const el = document.getElementById(
      `section-${currentChapterIndex + 1}-${sectionIndex + 1}`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentChapterIndex]);

  if (!currentChapter) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <p className="text-sm">暂无内容</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "h-full overflow-y-auto",
        isZenMode ? "max-w-3xl mx-auto px-8 py-12" : "p-6 md:p-8 lg:p-10",
      )}
    >
      {/* Chapter header */}
      {!isZenMode && (
        <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>第 {currentChapterIndex + 1} 章</span>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">{currentChapter.title}</h2>
          {currentChapter.description && (
            <p className="mt-1 text-sm text-zinc-500">{currentChapter.description}</p>
          )}
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
            generateSection={generateSection}
          />
        );
      })}
    </div>
  );
}

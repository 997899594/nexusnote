// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import { AlertCircle, BookOpen, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { useToast } from "@/components/ui/Toast";
import type { Annotation } from "@/hooks/useAnnotations";
import { useAnnotations } from "@/hooks/useAnnotations";
import type { SectionState } from "@/hooks/useChapterSections";
import type { LearnSectionDocProjection } from "@/lib/learning/projection";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { AnnotationLayer } from "./AnnotationLayer";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

interface SectionReaderProps {
  courseId: string;
  sections: Map<number, SectionState>;
  generateSection: (index: number) => void;
  sectionDocs: LearnSectionDocProjection[];
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
    <div className="ui-scrim fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-6 md:items-center md:px-0 md:pb-0 md:pt-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="ui-message-card safe-bottom w-full max-w-[32rem] rounded-[28px] p-4 md:w-[28rem] md:max-w-[calc(100vw-2rem)]"
      >
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">沉淀到笔记</h3>
        <div className="rounded-xl bg-[var(--color-panel-soft)] px-3 py-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {selectedText}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="补充你的理解、疑问或行动项（可选）"
          rows={4}
          className="mt-3 w-full resize-none rounded-xl border border-[var(--color-border)] p-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent-ring)]"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSubmit(text.trim())}
            className="ui-primary-button rounded-lg px-3 py-1.5 text-xs"
          >
            创建并打开
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SectionStateCard({
  icon,
  eyebrow,
  title,
  description,
  action,
  tone = "default",
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "ui-message-card rounded-[28px] px-5 py-6 md:px-6 md:py-7",
        tone === "error" && "border-rose-200/70 bg-rose-50/70",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            tone === "error"
              ? "bg-white text-rose-600"
              : "bg-[var(--color-active)] text-[var(--color-text)]",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {eyebrow}
          </div>
          <h3 className="mt-1 text-base font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">{description}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </motion.div>
  );
}

function SectionBlock({
  nodeId,
  sectionIndex,
  sectionTitle,
  state,
  sectionDoc,
  courseId,
  generateSection,
  isCurrentSection,
  isHighlighted,
}: {
  nodeId: string;
  sectionIndex: number;
  sectionTitle: string;
  state: SectionState;
  sectionDoc: LearnSectionDocProjection | undefined;
  courseId: string;
  generateSection: (index: number) => void;
  isCurrentSection: boolean;
  isHighlighted: boolean;
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
  const anchorId = nodeId;
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
    <div
      id={anchorId}
      className={cn(
        "relative scroll-mt-4 rounded-[32px] transition-all duration-300 md:scroll-mt-6",
        isCurrentSection && "bg-white/55",
        isHighlighted && "bg-[var(--color-panel-soft)] ring-1 ring-black/8",
      )}
    >
      {/* Section spacing */}
      {sectionIndex > 0 && <div className="pt-10 md:pt-14" />}

      {/* Section content */}
      <div ref={containerRef} className="relative">
        {(isCurrentSection || isHighlighted) && (
          <div className="mb-3 flex items-center gap-2 px-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.14em]",
                isHighlighted
                  ? "ui-primary-button"
                  : "bg-[var(--color-active)] text-[var(--color-text)]",
              )}
            >
              {isHighlighted ? "定位到这里" : "当前阅读"}
            </span>
          </div>
        )}

        {state.status === "idle" && (
          <SectionStateCard
            icon={<BookOpen className="h-5 w-5" />}
            eyebrow="Section Ready"
            title={sectionTitle}
            description="这一节还没有展开内容。点击生成后，会按当前课程上下文即时创建可阅读内容。"
            action={
              <button
                type="button"
                onClick={() => generateSection(sectionIndex)}
                className={cn(
                  "ui-primary-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200",
                  "hover:shadow-md",
                  "active:scale-[0.98]",
                )}
              >
                <Sparkles className="w-4 h-4" />
                生成内容
              </button>
            }
          />
        )}

        {state.status === "generating" && state.content.length === 0 && (
          <SectionStateCard
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            eyebrow="Generating"
            title={`正在生成「${sectionTitle}」`}
            description="系统正在基于课程上下文编写这一节内容。生成完成后会自动进入可阅读状态。"
            action={
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-[var(--color-panel-strong)]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            }
          />
        )}

        {(state.status === "generating" || state.status === "complete") && state.content && (
          <article className="ui-message-card rounded-[28px] px-5 py-5 md:px-8 md:py-8">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-black/5 pb-4">
              <div>
                <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Section
                </div>
                <div className="mt-1 text-sm font-medium text-[var(--color-text)]">
                  {sectionTitle}
                </div>
              </div>
              <span className="rounded-full bg-[var(--color-active)] px-3 py-1 text-[0.6875rem] font-medium text-[var(--color-text-secondary)]">
                {state.status === "generating" ? "生成中" : "已生成"}
              </span>
            </div>
            <div className="learn-prose">
              <StreamdownMessage
                content={state.content}
                isStreaming={state.status === "generating"}
              />
            </div>
          </article>
        )}

        {state.status === "error" && (
          <SectionStateCard
            icon={<AlertCircle className="h-5 w-5" />}
            eyebrow="Generation Error"
            title="这一节生成失败"
            description={state.error ?? "请稍后重试。"}
            tone="error"
            action={
              <button
                type="button"
                onClick={() => generateSection(sectionIndex)}
                className={cn(
                  "ui-message-card inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-all",
                  "hover:bg-[var(--color-panel-soft)]",
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重试
              </button>
            }
          />
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
  const {
    currentChapterIndex,
    currentSectionIndex,
    chapters,
    isZenMode,
    requestedSectionId,
    setCurrentSectionIndex,
    clearRequestedSectionFocus,
  } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToResume = useRef(false);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);

  const highlightSection = useCallback((sectionId: string) => {
    setHighlightedSectionId(sectionId);
    window.setTimeout(() => {
      setHighlightedSectionId((current) => (current === sectionId ? null : current));
    }, 1800);
  }, []);

  // Auto-scroll to resume section on mount
  useEffect(() => {
    if (!scrollToSectionId || hasScrolledToResume.current) return;
    // Delay to let the DOM render section anchors
    const timer = setTimeout(() => {
      const el = document.getElementById(scrollToSectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        hasScrolledToResume.current = true;
        highlightSection(scrollToSectionId);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [scrollToSectionId, highlightSection]);

  useEffect(() => {
    if (!requestedSectionId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const el = document.getElementById(requestedSectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        highlightSection(requestedSectionId);
      }

      clearRequestedSectionFocus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [requestedSectionId, clearRequestedSectionFocus, highlightSection]);

  // Intersection Observer to track visible section
  useEffect(() => {
    if (!scrollContainerRef.current || !currentChapter) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const secIdx = currentChapter.sections.findIndex(
              (section) => section.nodeId === entry.target.id,
            );
            if (secIdx >= 0) {
              setCurrentSectionIndex(secIdx);
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
    for (const section of currentChapter.sections) {
      const el = document.getElementById(section.nodeId);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [currentChapter, setCurrentSectionIndex]);

  if (!currentChapter) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        <p className="text-sm">暂无内容</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="mobile-scroll h-full overflow-y-auto">
      <div
        className={cn(
          "mx-auto w-full max-w-4xl",
          isZenMode
            ? "px-4 py-8 md:px-8 md:py-12 lg:px-10"
            : "px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10",
        )}
      >
        {/* Chapter header */}
        {!isZenMode && (
          <div className="sticky top-0 z-20 -mx-1 mb-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.9)_72%,rgba(255,255,255,0)_100%)] px-1 pb-4 pt-1 md:mb-8">
            <div className="ui-message-card rounded-[30px] px-5 py-4 backdrop-blur-xl md:px-7 md:py-5">
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-active)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]">
                  <Sparkles className="w-3 h-3" />第 {currentChapterIndex + 1} 章
                </span>
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Learning Chapter
                </span>
              </div>
              <h2 className="text-[1.3rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--color-text)] md:text-[1.5rem]">
                {currentChapter.title}
              </h2>
              {currentChapter.description && (
                <p className="mt-2 max-w-3xl text-[0.92rem] leading-6 text-[var(--color-text-secondary)] md:text-[0.95rem]">
                  {currentChapter.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        {currentChapter.sections.map((sec, secIdx) => {
          const state = sections.get(secIdx) ?? { content: "", status: "idle" as const };
          const nodeId = sec.nodeId;
          const sectionDoc = sectionDocs.find((d) => d.outlineNodeKey === nodeId);

          return (
            <SectionBlock
              key={nodeId}
              nodeId={nodeId}
              sectionIndex={secIdx}
              sectionTitle={sec.title}
              state={state}
              sectionDoc={sectionDoc}
              courseId={courseId}
              generateSection={generateSection}
              isCurrentSection={secIdx === currentSectionIndex}
              isHighlighted={highlightedSectionId === nodeId}
            />
          );
        })}

        {/* Bottom spacing */}
        <div className="h-28 md:h-24" />
      </div>
    </div>
  );
}

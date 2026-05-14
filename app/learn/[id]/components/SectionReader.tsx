// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  currentGenerating: number | null;
  generateSection: (index: number) => void;
  sectionDocs: LearnSectionDocProjection[];
  scrollToSectionId?: string | null;
}

interface SectionTarget {
  chapterIndex: number;
  sectionIndex: number;
  nodeId: string;
  title: string;
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
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">保存到笔记</h3>
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
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SectionStateBlock({
  title,
  description,
  action,
  tone = "default",
}: {
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
        "border-b border-black/5 px-1 py-8 md:px-2 md:py-10",
        tone === "error" && "border-rose-200/70",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h3
            className={cn(
              "text-base font-semibold text-[var(--color-text)]",
              tone === "error" && "text-rose-700",
            )}
          >
            {title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">{description}</p>
        </div>
        {action ? <div className="mt-4 md:mt-0">{action}</div> : null}
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
  isHighlighted,
}: {
  nodeId: string;
  sectionIndex: number;
  sectionTitle: string;
  state: SectionState;
  sectionDoc: LearnSectionDocProjection | undefined;
  courseId: string;
  generateSection: (index: number) => void;
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

        await response.json();
        addToast("已保存到笔记", "success");
        setPendingCapture(null);
      } catch {
        addToast("保存笔记失败，请稍后重试", "error");
      }
    },
    [addToast, pendingCapture, sectionDoc?.id],
  );

  return (
    <div
      id={anchorId}
      className={cn(
        "relative scroll-mt-4 rounded-[28px] transition-colors duration-300 md:scroll-mt-6",
        isHighlighted && "bg-[var(--color-panel-soft)] ring-1 ring-black/8",
      )}
    >
      <div ref={containerRef} className="relative">
        {isHighlighted && (
          <div className="mb-3 flex items-center gap-2 px-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.14em]",
                "ui-primary-button",
              )}
            >
              定位到这里
            </span>
          </div>
        )}

        {state.status === "idle" && (
          <SectionStateBlock
            title={sectionTitle}
            description="这一节还没有内容。"
            action={
              <button
                type="button"
                onClick={() => generateSection(sectionIndex)}
                className={cn(
                  "inline-flex items-center rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-all duration-200",
                  "hover:bg-[var(--color-panel-soft)]",
                  "active:scale-[0.98]",
                )}
              >
                开始阅读
              </button>
            }
          />
        )}

        {state.status === "queued" && (
          <SectionStateBlock
            title={sectionTitle}
            description="这一节已经加入生成队列。后台会继续生成，你可以离开本页，稍后回来直接阅读。"
            action={
              <div className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                等待生成
              </div>
            }
          />
        )}

        {state.status === "generating" && state.content.length === 0 && (
          <SectionStateBlock
            title={sectionTitle}
            description="后台生成器已经接管，内容准备好后会自动出现。"
            action={
              <div className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                生成中
              </div>
            }
          />
        )}

        {(state.status === "generating" || state.status === "complete") && state.content && (
          <article className="px-1 py-1 md:px-2">
            <h3 className="mb-5 text-xl font-semibold leading-tight tracking-[-0.03em] text-[var(--color-text)] md:text-2xl">
              {sectionTitle}
            </h3>
            <div className="learn-prose border-b border-black/5 pb-10 md:pb-12">
              <StreamdownMessage
                content={state.content}
                isStreaming={state.status === "generating"}
              />
            </div>
          </article>
        )}

        {state.status === "error" && (
          <SectionStateBlock
            title="这一节暂时没有准备好"
            description={state.error ?? "可以稍后再试。"}
            tone="error"
            action={
              <button
                type="button"
                onClick={() => generateSection(sectionIndex)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-all",
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

function SectionBoundary({
  previousTitle,
  nextTitle,
  hasPrevious,
  hasNext,
  onPrevious,
  onOpenChat,
  onNext,
}: {
  previousTitle?: string;
  nextTitle?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onOpenChat: () => void;
  onNext: () => void;
}) {
  return (
    <section className="mt-14 border-t border-black/6 pt-6 md:mt-16 md:pt-8">
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr]">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className={cn(
            "group flex min-h-14 items-center gap-2 rounded-full px-2.5 py-2 text-left transition-all",
            !hasPrevious
              ? "cursor-not-allowed text-[var(--color-text-muted)]"
              : "text-[var(--color-text)] hover:bg-[var(--color-panel-soft)]",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel-soft)]">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--color-text-tertiary)]">
              上一节
            </span>
            <span className="mt-1 line-clamp-2 text-sm font-medium">
              {previousTitle ?? "已经是第一节"}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenChat}
          className="group flex min-h-14 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-[var(--color-text)] transition-all hover:bg-[var(--color-panel-soft)]"
        >
          <MessageSquare className="h-4 w-4 text-[var(--color-text-secondary)]" />
          问这一节
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={cn(
            "group flex min-h-14 items-center justify-between gap-2 rounded-full px-2.5 py-2 text-left transition-all",
            !hasNext
              ? "cursor-not-allowed text-[var(--color-text-muted)]"
              : "bg-[var(--color-panel-strong)] text-white hover:bg-[var(--color-panel-strong)]/90",
          )}
        >
          <span className="min-w-0">
            <span
              className={cn(
                "block text-[0.6875rem] font-semibold tracking-[0.14em]",
                !hasNext ? "text-[var(--color-text-tertiary)]" : "text-white/62",
              )}
            >
              下一节
            </span>
            <span className="mt-1 line-clamp-2 text-sm font-medium">
              {nextTitle ?? "课程已经读完"}
            </span>
          </span>
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              !hasNext ? "bg-[var(--color-panel-soft)]" : "bg-white/14",
            )}
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </section>
  );
}

export function SectionReader({
  courseId,
  sections,
  currentGenerating,
  generateSection,
  sectionDocs,
  scrollToSectionId,
}: SectionReaderProps) {
  const {
    currentChapterIndex,
    chapters,
    requestedSectionId,
    expandChapter,
    setChatOpen,
    setCurrentSectionIndex,
    setCurrentChapterIndex,
    clearRequestedSectionFocus,
  } = useLearnStore();
  const currentChapter = chapters[currentChapterIndex];
  const currentSectionIndex = useLearnStore((s) => s.currentSectionIndex);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousSectionIdRef = useRef<string | null>(null);
  const hasScrolledToResume = useRef(false);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);

  const sectionTargets = useMemo(
    () =>
      chapters.flatMap<SectionTarget>((chapter, chapterIndex) =>
        chapter.sections.map((section, sectionIndex) => ({
          chapterIndex,
          sectionIndex,
          nodeId: section.nodeId,
          title: section.title,
        })),
      ),
    [chapters],
  );
  const currentTargetIndex = sectionTargets.findIndex(
    (target) =>
      target.chapterIndex === currentChapterIndex && target.sectionIndex === currentSectionIndex,
  );
  const currentTarget = currentTargetIndex >= 0 ? sectionTargets[currentTargetIndex] : null;
  const previousTarget = currentTargetIndex > 0 ? sectionTargets[currentTargetIndex - 1] : null;
  const nextTarget =
    currentTargetIndex >= 0 && currentTargetIndex + 1 < sectionTargets.length
      ? sectionTargets[currentTargetIndex + 1]
      : null;

  const highlightSection = useCallback((sectionId: string) => {
    setHighlightedSectionId(sectionId);
    window.setTimeout(() => {
      setHighlightedSectionId((current) => (current === sectionId ? null : current));
    }, 1800);
  }, []);

  const navigateToSection = useCallback(
    (target: SectionTarget | null) => {
      if (!target) {
        return;
      }

      clearRequestedSectionFocus();
      expandChapter(target.chapterIndex);
      if (target.chapterIndex !== currentChapterIndex) {
        setCurrentChapterIndex(target.chapterIndex);
      }
      setCurrentSectionIndex(target.sectionIndex);
    },
    [
      clearRequestedSectionFocus,
      currentChapterIndex,
      expandChapter,
      setCurrentChapterIndex,
      setCurrentSectionIndex,
    ],
  );

  useEffect(() => {
    const activeSectionId = currentTarget?.nodeId ?? null;
    if (!activeSectionId || previousSectionIdRef.current === activeSectionId) {
      return;
    }

    previousSectionIdRef.current = activeSectionId;
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setHighlightedSectionId(null);
  }, [currentTarget?.nodeId]);

  useEffect(() => {
    if (!scrollToSectionId || hasScrolledToResume.current) return;

    const target = sectionTargets.find((section) => section.nodeId === scrollToSectionId);
    if (!target) return;

    navigateToSection(target);
    const timer = setTimeout(() => {
      const el = document.getElementById(scrollToSectionId);
      if (el) {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        hasScrolledToResume.current = true;
        highlightSection(scrollToSectionId);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [scrollToSectionId, sectionTargets, navigateToSection, highlightSection]);

  useEffect(() => {
    if (!requestedSectionId) {
      return;
    }

    const target = sectionTargets.find((section) => section.nodeId === requestedSectionId);
    if (target) {
      navigateToSection(target);
    }

    const timer = window.setTimeout(() => {
      const el = document.getElementById(requestedSectionId);
      if (el) {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        highlightSection(requestedSectionId);
      }

      clearRequestedSectionFocus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    requestedSectionId,
    sectionTargets,
    navigateToSection,
    clearRequestedSectionFocus,
    highlightSection,
  ]);

  useEffect(() => {
    if (!currentChapter || currentSectionIndex < currentChapter.sections.length) {
      return;
    }

    setCurrentSectionIndex(0);
  }, [currentChapter, currentSectionIndex, setCurrentSectionIndex]);

  const currentSection = currentChapter?.sections[currentSectionIndex] ?? null;
  const hasCurrentSectionState = sections.has(currentSectionIndex);
  const currentSectionState = sections.get(currentSectionIndex) ?? {
    content: "",
    status: "idle" as const,
  };

  useEffect(() => {
    if (
      !currentSection ||
      !hasCurrentSectionState ||
      currentSectionState.status !== "idle" ||
      currentGenerating !== null
    ) {
      return;
    }

    generateSection(currentSectionIndex);
  }, [
    currentSection,
    currentSectionIndex,
    hasCurrentSectionState,
    currentSectionState.status,
    currentGenerating,
    generateSection,
  ]);

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
          "mx-auto w-full max-w-[820px]",
          "px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10",
        )}
      >
        <div className="sticky top-0 z-20 -mx-1 mb-8 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.9)_72%,rgba(255,255,255,0)_100%)] px-1 pb-5 pt-1">
          <div className="max-w-3xl">
            <div className="mb-2 text-[0.6875rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
              第 {currentChapterIndex + 1} 章
            </div>
            <h2 className="text-[1.55rem] font-semibold leading-tight tracking-[-0.045em] text-[var(--color-text)] md:text-[1.85rem]">
              {currentChapter.title}
            </h2>
            {currentChapter.description ? (
              <p className="mt-2 max-w-2xl text-[0.92rem] leading-7 text-[var(--color-text-secondary)]">
                {currentChapter.description}
              </p>
            ) : null}
          </div>
        </div>

        {currentSection ? (
          <SectionBlock
            key={currentSection.nodeId}
            nodeId={currentSection.nodeId}
            sectionIndex={currentSectionIndex}
            sectionTitle={currentSection.title}
            state={currentSectionState}
            sectionDoc={sectionDocs.find((doc) => doc.outlineNodeKey === currentSection.nodeId)}
            courseId={courseId}
            generateSection={generateSection}
            isHighlighted={highlightedSectionId === currentSection.nodeId}
          />
        ) : (
          <SectionStateBlock title="暂无小节" description="这一章还没有可阅读的小节。" />
        )}

        <SectionBoundary
          previousTitle={previousTarget?.title}
          nextTitle={nextTarget?.title}
          hasPrevious={Boolean(previousTarget)}
          hasNext={Boolean(nextTarget)}
          onPrevious={() => navigateToSection(previousTarget)}
          onOpenChat={() => setChatOpen(true)}
          onNext={() => navigateToSection(nextTarget)}
        />

        {/* Bottom spacing */}
        <div className="h-28 md:h-24" />
      </div>
    </div>
  );
}

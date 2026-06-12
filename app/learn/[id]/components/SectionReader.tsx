// app/learn/[id]/components/SectionReader.tsx

"use client";

import { motion } from "framer-motion";
import {
  BookPlus,
  ExternalLink,
  EyeOff,
  Highlighter,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { TextSelectionActionBar } from "@/components/course-reader/TextSelectionActionBar";
import { useToast } from "@/components/ui/Toast";
import type { Annotation } from "@/hooks/useAnnotations";
import { useAnnotations } from "@/hooks/useAnnotations";
import type { SectionState } from "@/hooks/useChapterSections";
import { stripLeadingSectionHeading, stripSectionNumber } from "@/lib/learning/content-formatting";
import { persistCompletedSection } from "@/lib/learning/learn-progress-client";
import type {
  LearnChapterProjection,
  LearnPublicAnnotationProjection,
  LearnSectionDocProjection,
} from "@/lib/learning/projection";
import {
  mergePublicAnnotationMutation,
  updatePublicAnnotationStatus,
} from "@/lib/learning/public-course-client";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { AnnotationLayer } from "./AnnotationLayer";

interface SectionReaderProps {
  courseId: string;
  sections: Map<number, SectionState>;
  currentGenerating: number | null;
  generateSection: (index: number) => void;
  sectionDocs: LearnSectionDocProjection[];
  publicAnnotations: LearnPublicAnnotationProjection[];
  scrollToSectionId?: string | null;
}

interface SectionTarget {
  chapterIndex: number;
  sectionIndex: number;
  nodeId: string;
  title: string;
}

const HIGHLIGHT_COLORS = [
  { label: "黄色标记", value: "#fef08a" },
  { label: "绿色标记", value: "#bbf7d0" },
  { label: "蓝色标记", value: "#bfdbfe" },
  { label: "粉色标记", value: "#fecdd3" },
];

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
        className="ui-message-card safe-bottom w-[min(32rem,calc(100vw-1.5rem))] rounded-[28px] p-4"
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

function formatAnnotationTime(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionNotesPanel({
  privateAnnotations,
  publicAnnotations,
  moderatingAnnotationId,
  onModeratePublicAnnotation,
  onClose,
}: {
  privateAnnotations: Annotation[];
  publicAnnotations: LearnPublicAnnotationProjection[];
  moderatingAnnotationId: string | null;
  onModeratePublicAnnotation: (
    annotation: LearnPublicAnnotationProjection,
    status: LearnPublicAnnotationProjection["status"],
  ) => void;
  onClose: () => void;
}) {
  const totalCount = privateAnnotations.length + publicAnnotations.length;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="关闭评论"
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="safe-bottom absolute inset-y-0 right-0 flex w-[min(88vw,23rem)] flex-col overflow-hidden border-l border-black/[0.08] bg-white shadow-[0_24px_84px_-42px_rgba(15,23,42,0.45)] md:w-[22.5rem]">
        <div className="safe-top flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">评论</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
              {totalCount > 0 ? `${totalCount} 条当前小节记录` : "当前小节暂无记录"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {totalCount > 0 ? (
            <div className="space-y-2">
              {publicAnnotations[0]?.publicationSlug ? (
                <a
                  href={`/c/${publicAnnotations[0].publicationSlug}`}
                  className="mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text)]"
                >
                  查看公开页
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}

              {publicAnnotations.map((annotation) => (
                <article
                  key={annotation.id}
                  className={cn(
                    "border-l-2 px-3 py-3",
                    annotation.status === "hidden"
                      ? "border-black/[0.12] bg-black/[0.018] opacity-75"
                      : "border-black/[0.08]",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">
                      读者评论
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onModeratePublicAnnotation(
                          annotation,
                          annotation.status === "hidden" ? "visible" : "hidden",
                        )
                      }
                      disabled={moderatingAnnotationId === annotation.id}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={annotation.status === "hidden" ? "恢复评论" : "隐藏评论"}
                    >
                      {annotation.status === "hidden" ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                    “{annotation.quotedText}”
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">
                    {annotation.body}
                  </p>
                  <p className="mt-2 min-w-0 truncate text-[0.625rem] text-[var(--color-text-tertiary)]">
                    {annotation.author.name ? `${annotation.author.name} · ` : ""}
                    {formatAnnotationTime(annotation.createdAt)}
                    {annotation.status === "hidden" ? " · 已隐藏" : ""}
                  </p>
                </article>
              ))}

              {privateAnnotations.map((annotation) => (
                <article
                  key={annotation.id}
                  className="rounded-xl border border-black/[0.06] bg-[var(--color-panel-soft)] px-3 py-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: annotation.color ?? "#fef08a" }}
                      aria-hidden="true"
                    />
                    <span className="text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">
                      我的笔记
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    “{annotation.anchor.textContent}”
                  </p>
                  {annotation.noteContent ? (
                    <p className="mt-2 border-t border-black/[0.05] pt-2 text-sm leading-6 text-[var(--color-text)]">
                      {annotation.noteContent}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="px-1 py-8 text-sm leading-6 text-[var(--color-text-secondary)]">
              暂无评论。选中正文可以标记、保存笔记或发起对话。
            </div>
          )}
        </div>
      </aside>
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
      className="px-1 py-8 md:px-2 md:py-10"
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

function SectionLoadingBlock({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-1 py-7 md:px-2 md:py-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--color-text)]">内容准备中</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            正在生成内容，完成后会自动展开。
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {label}
        </div>
      </div>
    </motion.div>
  );
}

function SectionIntro({
  chapterIndex,
  chapterTitle,
  sectionTitle,
  sectionDescription,
  chapterDescription,
}: {
  chapterIndex: number;
  chapterTitle: string;
  sectionTitle: string;
  sectionDescription: string;
  chapterDescription: string;
}) {
  const intro = sectionDescription.trim() || chapterDescription.trim();

  return (
    <header className="mb-7 md:mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)]">
        <span>第 {chapterIndex + 1} 章</span>
        <span className="h-1 w-1 rounded-full bg-black/20" aria-hidden="true" />
        <span className="line-clamp-1">{chapterTitle}</span>
      </div>
      <h1 className="text-[1.9rem] font-semibold leading-tight text-[var(--color-text)] md:text-[2.35rem]">
        {sectionTitle}
      </h1>
      {intro ? (
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {intro}
        </p>
      ) : null}
    </header>
  );
}

function SectionBlock({
  nodeId,
  chapterIndex,
  chapter,
  sectionIndex,
  sectionTitle,
  sectionDescription,
  state,
  sectionDoc,
  publicAnnotations,
  courseId,
  generateSection,
  isHighlighted,
}: {
  nodeId: string;
  chapterIndex: number;
  chapter: LearnChapterProjection;
  sectionIndex: number;
  sectionTitle: string;
  sectionDescription: string;
  state: SectionState;
  sectionDoc: LearnSectionDocProjection | undefined;
  publicAnnotations: LearnPublicAnnotationProjection[];
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
  const [sectionPublicAnnotations, setSectionPublicAnnotations] = useState(publicAnnotations);
  const [moderatingAnnotationId, setModeratingAnnotationId] = useState<string | null>(null);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const completedSections = useLearnStore((s) => s.completedSections);
  const isNotesOpen = useLearnStore((s) => s.isNotesOpen);
  const setNotesOpen = useLearnStore((s) => s.setNotesOpen);
  const setChatOpen = useLearnStore((s) => s.setChatOpen);
  const setDesktopChatCollapsed = useLearnStore((s) => s.setDesktopChatCollapsed);
  const setChatSelectionContext = useLearnStore((s) => s.setChatSelectionContext);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const currentChapter = useLearnStore((s) => s.chapters[s.currentChapterIndex]);
  const setCurrentSectionAnnotationCount = useLearnStore((s) => s.setCurrentSectionAnnotationCount);
  const { addToast } = useToast();

  const { annotations, addHighlight, removeAnnotation } = useAnnotations({
    sectionId: sectionDoc?.id,
    initialAnnotations: sectionDoc?.annotations ?? [],
  });

  const isComplete = state.status === "complete";
  const anchorId = nodeId;
  const isAlreadyRead = completedSections.has(anchorId);
  const canShowFocusMarker = isHighlighted && (isComplete || state.content.length > 0);
  const readableContent = state.content
    ? stripLeadingSectionHeading(state.content, sectionTitle)
    : "";

  useEffect(() => {
    setSectionPublicAnnotations(publicAnnotations);
  }, [publicAnnotations]);

  useEffect(() => {
    setCurrentSectionAnnotationCount(annotations.length + sectionPublicAnnotations.length);
  }, [annotations.length, sectionPublicAnnotations.length, setCurrentSectionAnnotationCount]);

  useEffect(() => {
    return () => {
      setCurrentSectionAnnotationCount(0);
    };
  }, [setCurrentSectionAnnotationCount]);

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

              persistCompletedSection({ courseId, sectionNodeId: anchorId }).catch((err) => {
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

  const handleModeratePublicAnnotation = useCallback(
    async (
      annotation: LearnPublicAnnotationProjection,
      status: LearnPublicAnnotationProjection["status"],
    ) => {
      setModeratingAnnotationId(annotation.id);

      try {
        const payload = await updatePublicAnnotationStatus<LearnPublicAnnotationProjection>({
          publicationSlug: annotation.publicationSlug,
          annotationId: annotation.id,
          status,
        });
        const nextAnnotation = mergePublicAnnotationMutation(annotation, payload, status);
        setSectionPublicAnnotations((current) =>
          current.map((item) => (item.id === annotation.id ? nextAnnotation : item)),
        );
        addToast(status === "hidden" ? "已隐藏公共评论" : "已恢复公共评论", "success");
      } catch {
        addToast("更新公共评论失败，请稍后重试", "error");
      } finally {
        setModeratingAnnotationId(null);
      }
    },
    [addToast],
  );

  return (
    <div
      id={anchorId}
      className={cn(
        "relative scroll-mt-4 rounded-[28px] transition-colors duration-300 md:scroll-mt-6",
        canShowFocusMarker && "bg-[var(--color-panel-soft)] ring-1 ring-black/8",
      )}
    >
      <div ref={containerRef} className="relative">
        {canShowFocusMarker && (
          <div className="mb-3 flex items-center gap-2 px-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.14em]",
                "ui-primary-button",
              )}
            >
              当前小节
            </span>
          </div>
        )}

        <SectionIntro
          chapterIndex={chapterIndex}
          chapterTitle={stripSectionNumber(chapter.title)}
          sectionTitle={sectionTitle}
          sectionDescription={sectionDescription}
          chapterDescription={chapter.description}
        />

        {state.status === "idle" && (
          <SectionStateBlock
            title="这一节还没有内容"
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

        {state.status === "queued" && <SectionLoadingBlock label="准备中" />}

        {state.status === "generating" && !readableContent && (
          <SectionLoadingBlock label="生成中" />
        )}

        {(state.status === "generating" || state.status === "complete") && readableContent && (
          <article className="px-1 py-1 md:px-2">
            <div className="learn-prose pb-10 md:pb-12">
              <StreamdownMessage
                content={readableContent}
                isStreaming={state.status === "generating"}
                variant="reader"
                controls={{ code: false, mermaid: false, table: false }}
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
            />
            <TextSelectionActionBar
              containerRef={containerRef}
              swatchAction={{ label: "标记", icon: Highlighter }}
              swatches={HIGHLIGHT_COLORS}
              onSwatchSelect={addHighlight}
              actions={[
                {
                  label: "笔记",
                  icon: BookPlus,
                  variant: "primary",
                  onSelect: ({ anchor, selectedText }) => {
                    setPendingCapture({ anchor, selectedText });
                  },
                },
                {
                  label: "对话",
                  icon: MessageSquareQuote,
                  onSelect: ({ selectedText }) => {
                    setChatSelectionContext({
                      id: crypto.randomUUID(),
                      text: selectedText,
                      chapterIndex: currentChapterIndex,
                      sectionIndex,
                      chapterTitle: currentChapter?.title,
                      sectionTitle,
                    });
                    setChatOpen(true);
                    setDesktopChatCollapsed(false);
                  },
                },
              ]}
            />
          </>
        )}

        {isNotesOpen ? (
          <SectionNotesPanel
            privateAnnotations={annotations}
            publicAnnotations={sectionPublicAnnotations}
            moderatingAnnotationId={moderatingAnnotationId}
            onModeratePublicAnnotation={(annotation, status) => {
              void handleModeratePublicAnnotation(annotation, status);
            }}
            onClose={() => setNotesOpen(false)}
          />
        ) : null}

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
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section className="mt-8 border-t border-black/[0.04] pt-4 md:mt-10 md:pt-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          className={cn(
            "min-h-9 px-0 text-sm font-medium transition-colors",
            !hasPrevious
              ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-50"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
          )}
        >
          上一章
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={cn(
            "min-h-9 px-0 text-sm font-medium transition-colors",
            !hasNext
              ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-50"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
          )}
        >
          下一章
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
  publicAnnotations,
  scrollToSectionId,
}: SectionReaderProps) {
  const {
    currentChapterIndex,
    chapters,
    requestedSectionId,
    expandChapter,
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
  const currentSectionPublicAnnotations = useMemo(
    () =>
      currentSection
        ? publicAnnotations.filter((annotation) => annotation.sectionKey === currentSection.nodeId)
        : [],
    [currentSection, publicAnnotations],
  );

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
        className={cn("mx-auto w-full max-w-[780px]", "px-4 py-5 md:px-8 md:py-7 lg:px-10 lg:py-8")}
      >
        {currentSection ? (
          <SectionBlock
            key={currentSection.nodeId}
            nodeId={currentSection.nodeId}
            chapterIndex={currentChapterIndex}
            chapter={currentChapter}
            sectionIndex={currentSectionIndex}
            sectionTitle={stripSectionNumber(currentSection.title)}
            sectionDescription={currentSection.description}
            state={currentSectionState}
            sectionDoc={sectionDocs.find((doc) => doc.outlineNodeKey === currentSection.nodeId)}
            publicAnnotations={currentSectionPublicAnnotations}
            courseId={courseId}
            generateSection={generateSection}
            isHighlighted={highlightedSectionId === currentSection.nodeId}
          />
        ) : (
          <SectionStateBlock title="暂无小节" description="这一章还没有可阅读的小节。" />
        )}

        <SectionBoundary
          hasPrevious={Boolean(previousTarget)}
          hasNext={Boolean(nextTarget)}
          onPrevious={() => navigateToSection(previousTarget)}
          onNext={() => navigateToSection(nextTarget)}
        />

        {/* Bottom spacing */}
        <div className="h-28 md:h-24" />
      </div>
    </div>
  );
}

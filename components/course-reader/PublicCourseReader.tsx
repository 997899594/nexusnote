"use client";

import {
  BookOpenText,
  Clock3,
  Copy,
  ExternalLink,
  EyeOff,
  Link2,
  MessageSquarePlus,
  RotateCcw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { useToast } from "@/components/ui/Toast";
import type {
  PublicCourseAnnotationProjection,
  PublicCourseReaderProjection,
} from "@/lib/learning/course-sharing-types";
import { cn } from "@/lib/utils";

interface PublicCourseReaderProps {
  data: PublicCourseReaderProjection;
}

interface SelectionDraft {
  sectionKey: string;
  quotedText: string;
  anchor: {
    textContent: string;
    startOffset: number;
    endOffset: number;
  };
}

function getSelectionDraft(sectionKey: string, container: HTMLElement): SelectionDraft | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const quotedText = selection.toString().trim();
  if (!quotedText) {
    return null;
  }

  const containerText = container.textContent ?? "";
  const selectedStart = containerText.indexOf(quotedText);
  if (selectedStart < 0) {
    return null;
  }

  const contextStart = Math.max(0, selectedStart - 80);
  const contextEnd = Math.min(containerText.length, selectedStart + quotedText.length + 80);
  const textContent = containerText.slice(contextStart, contextEnd);

  return {
    sectionKey,
    quotedText,
    anchor: {
      textContent,
      startOffset: selectedStart - contextStart,
      endOffset: selectedStart - contextStart + quotedText.length,
    },
  };
}

interface PublicAnnotationHighlight {
  annotationId: string;
  rects: Array<{
    top: number;
    left: number;
    width: number;
    height: number;
  }>;
}

const EMPTY_PUBLIC_ANNOTATIONS: PublicCourseAnnotationProjection[] = [];

function findAnnotationRange(
  container: HTMLElement,
  annotation: PublicCourseAnnotationProjection,
): Range | null {
  const text = container.textContent ?? "";
  const contextIndex = text.indexOf(annotation.anchor.textContent);
  const quoteIndex = text.indexOf(annotation.quotedText);

  const absoluteStart =
    contextIndex >= 0 ? contextIndex + annotation.anchor.startOffset : quoteIndex;
  const absoluteEnd =
    contextIndex >= 0
      ? contextIndex + annotation.anchor.endOffset
      : quoteIndex + annotation.quotedText.length;

  if (absoluteStart < 0 || absoluteEnd <= absoluteStart) {
    return null;
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startSet = false;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeLength = node.length;

    if (!startSet && currentOffset + nodeLength > absoluteStart) {
      range.setStart(node, absoluteStart - currentOffset);
      startSet = true;
    }

    if (startSet && currentOffset + nodeLength >= absoluteEnd) {
      range.setEnd(node, absoluteEnd - currentOffset);
      return range;
    }

    currentOffset += nodeLength;
  }

  return null;
}

function getAnnotationHighlights(
  container: HTMLElement,
  annotations: PublicCourseAnnotationProjection[],
): PublicAnnotationHighlight[] {
  const containerRect = container.getBoundingClientRect();

  return annotations.flatMap((annotation) => {
    const range = findAnnotationRange(container, annotation);
    if (!range) {
      return [];
    }

    const rects = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height,
      }));

    if (rects.length === 0) {
      return [];
    }

    return [{ annotationId: annotation.id, rects }];
  });
}

function formatDifficulty(value: string | null): string {
  switch (value) {
    case "beginner":
      return "入门";
    case "intermediate":
      return "进阶";
    case "advanced":
      return "高级";
    default:
      return value ?? "课程";
  }
}

function formatEstimatedMinutes(value: number | null): string {
  if (!value) {
    return "结构化课程";
  }

  if (value >= 60) {
    return `${Math.round(value / 60)} 小时`;
  }

  return `${value} 分钟`;
}

export function PublicCourseReader({ data }: PublicCourseReaderProps) {
  const { addToast } = useToast();
  const [activeSectionKey, setActiveSectionKey] = useState(
    () => data.content.outline.chapters[0]?.sections[0]?.nodeId ?? "",
  );
  const [annotations, setAnnotations] = useState(data.annotations);
  const [savedCourseId, setSavedCourseId] = useState(data.savedCourseId);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [annotationHighlights, setAnnotationHighlights] = useState<PublicAnnotationHighlight[]>([]);
  const [isSubmittingAnnotation, setIsSubmittingAnnotation] = useState(false);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [moderatingAnnotationId, setModeratingAnnotationId] = useState<string | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const articleContentRef = useRef<HTMLDivElement | null>(null);
  const isOwnerView = data.capabilities.canModeratePublicAnnotations;
  const visibleAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.status === "visible"),
    [annotations],
  );
  const displayAnnotations = useMemo(
    () => (isOwnerView ? annotations : visibleAnnotations),
    [annotations, isOwnerView, visibleAnnotations],
  );
  const annotationsBySection = useMemo(() => {
    const map = new Map<string, PublicCourseAnnotationProjection[]>();
    for (const annotation of displayAnnotations) {
      const existing = map.get(annotation.sectionKey) ?? [];
      existing.push(annotation);
      map.set(annotation.sectionKey, existing);
    }
    return map;
  }, [displayAnnotations]);
  const visibleAnnotationsBySection = useMemo(() => {
    const map = new Map<string, PublicCourseAnnotationProjection[]>();
    for (const annotation of visibleAnnotations) {
      const existing = map.get(annotation.sectionKey) ?? [];
      existing.push(annotation);
      map.set(annotation.sectionKey, existing);
    }
    return map;
  }, [visibleAnnotations]);

  const activeSection =
    data.content.sections.find((section) => section.nodeId === activeSectionKey) ??
    data.content.sections[0] ??
    null;
  const activeSectionAnnotations =
    annotationsBySection.get(activeSectionKey) ?? EMPTY_PUBLIC_ANNOTATIONS;
  const activeVisibleAnnotations =
    visibleAnnotationsBySection.get(activeSectionKey) ?? EMPTY_PUBLIC_ANNOTATIONS;
  const hiddenAnnotationCount = annotations.filter(
    (annotation) => annotation.status === "hidden",
  ).length;
  const totalSections = data.content.sections.length;

  useEffect(() => {
    const container = articleContentRef.current;
    if (!container || activeVisibleAnnotations.length === 0) {
      setAnnotationHighlights([]);
      return;
    }

    const updateHighlights = () => {
      setAnnotationHighlights(getAnnotationHighlights(container, activeVisibleAnnotations));
    };

    updateHighlights();
    const animationFrameId = requestAnimationFrame(() => {
      requestAnimationFrame(updateHighlights);
    });

    const resizeObserver = new ResizeObserver(updateHighlights);
    resizeObserver.observe(container);
    const mutationObserver = new MutationObserver(updateHighlights);
    mutationObserver.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    const timeoutIds = [250, 750, 1500, 3000].map((delay) =>
      window.setTimeout(updateHighlights, delay),
    );
    window.addEventListener("resize", updateHighlights);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("resize", updateHighlights);
    };
  }, [activeVisibleAnnotations]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    addToast("已复制公开链接", "success");
  };

  const focusAnnotation = (annotationId: string) => {
    setActiveAnnotationId(annotationId);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-public-annotation-id="${annotationId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  };

  const handleAddAnnotation = (sectionKey: string) => {
    const container = sectionRefs.current.get(sectionKey);
    if (!container) {
      return;
    }

    const draft = getSelectionDraft(sectionKey, container);
    if (!draft) {
      addToast("先选中一段正文再添加批注", "info");
      return;
    }

    if (!data.capabilities.canAnnotatePublicly) {
      addToast("登录后可以添加公共批注", "info");
      return;
    }

    setSelectionDraft(draft);
    setAnnotationBody("");
    window.getSelection()?.removeAllRanges();
  };

  const saveToLibrary = async () => {
    if (savedCourseId) {
      window.location.href = `/learn/${savedCourseId}`;
      return;
    }

    if (!data.viewer.userId) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/c/${data.publication.slug}`)}`;
      return;
    }

    setIsSavingCourse(true);

    try {
      const response = await fetch(`/api/public/courses/${data.publication.slug}/save`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to save public course.");
      }

      const payload = (await response.json()) as {
        courseId?: string;
        learnUrl?: string;
        alreadySaved?: boolean;
      };
      if (!payload.learnUrl) {
        throw new Error("Missing saved course URL.");
      }

      if (payload.courseId) {
        setSavedCourseId(payload.courseId);
      }

      window.location.href = payload.learnUrl;
    } catch {
      addToast("保存课程失败，请稍后重试", "error");
      setIsSavingCourse(false);
    }
  };

  const updateAnnotationStatus = async (
    annotation: PublicCourseAnnotationProjection,
    status: PublicCourseAnnotationProjection["status"],
  ) => {
    setModeratingAnnotationId(annotation.id);

    try {
      const response = await fetch(
        `/api/public/courses/${data.publication.slug}/annotations/${annotation.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update public annotation.");
      }

      const payload = (await response.json()) as {
        annotation?: PublicCourseAnnotationProjection;
      };
      const nextAnnotation = payload.annotation ?? { ...annotation, status };

      setAnnotations((current) =>
        current.map((item) => (item.id === annotation.id ? nextAnnotation : item)),
      );
      addToast(status === "hidden" ? "公共批注已隐藏" : "公共批注已恢复", "success");
    } catch {
      addToast("更新公共批注失败，请稍后重试", "error");
    } finally {
      setModeratingAnnotationId(null);
    }
  };

  const submitAnnotation = async () => {
    if (!selectionDraft || !annotationBody.trim()) {
      return;
    }

    setIsSubmittingAnnotation(true);

    try {
      const response = await fetch(`/api/public/courses/${data.publication.slug}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectionDraft,
          body: annotationBody.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create public annotation.");
      }

      const payload = (await response.json()) as {
        annotation?: PublicCourseAnnotationProjection;
      };
      if (payload.annotation) {
        setAnnotations((current) => [
          ...current,
          payload.annotation as PublicCourseAnnotationProjection,
        ]);
      }

      addToast("公共批注已发布", "success");
      setSelectionDraft(null);
      setAnnotationBody("");
    } catch {
      addToast("发布批注失败，请稍后重试", "error");
    } finally {
      setIsSubmittingAnnotation(false);
    }
  };

  return (
    <main className="ui-page-shell min-h-dvh overflow-hidden">
      <div className="mx-auto grid h-dvh max-w-[1640px] grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)_minmax(18rem,22rem)] lg:overflow-hidden lg:p-4">
        <aside className="min-h-0 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/78 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:h-full">
          <div className="border-b border-black/[0.04] px-4 py-5">
            <Link
              href="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]"
              aria-label="返回首页"
            >
              <BookOpenText className="h-4.5 w-4.5" />
            </Link>
            <p className="mt-5 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
              公开课程
            </p>
            <h1 className="mt-2 line-clamp-3 text-[1rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-text)]">
              {data.content.course.title}
            </h1>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--color-text-secondary)]">
              {data.content.course.description ?? "来自 NexusNote 的公开课程。"}
            </p>
          </div>

          <div className="mobile-scroll min-h-0 max-h-72 overflow-y-auto px-3 py-4 lg:max-h-none">
            <div className="mb-3 px-1 text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
              目录
            </div>
            <div className="space-y-3">
              {data.content.outline.chapters.map((chapter, chapterIndex) => (
                <section key={`${chapterIndex}-${chapter.title}`}>
                  <h2 className="px-2 text-xs font-semibold text-[var(--color-text)]">
                    {chapter.title}
                  </h2>
                  <div className="mt-1 space-y-1">
                    {chapter.sections.map((section) => {
                      const active = section.nodeId === activeSectionKey;
                      const annotationCount =
                        visibleAnnotationsBySection.get(section.nodeId)?.length ?? 0;

                      return (
                        <button
                          key={section.nodeId}
                          type="button"
                          onClick={() => setActiveSectionKey(section.nodeId)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                            active
                              ? "bg-[var(--color-panel-soft)] text-[var(--color-text)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                          )}
                        >
                          <span className="line-clamp-2">{section.title}</span>
                          {annotationCount > 0 ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[0.625rem] text-[var(--color-text-tertiary)]">
                              {annotationCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[30px] border border-black/[0.04] bg-white/94 shadow-[0_24px_76px_-58px_rgba(15,23,42,0.32)] lg:h-full">
          <header className="flex shrink-0 flex-col gap-4 border-b border-black/[0.04] bg-white/86 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-start sm:justify-between lg:px-7">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)]">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenText className="h-3.5 w-3.5" />
                  {data.content.outline.chapters.length} 章 · {totalSections} 节
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatEstimatedMinutes(data.content.course.estimatedMinutes)}
                </span>
                <span>{formatDifficulty(data.content.course.difficulty)}</span>
              </div>
              <h2 className="line-clamp-2 text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)] sm:truncate">
                {data.content.course.title}
              </h2>
              <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {data.content.course.learningOutcome ??
                  data.content.course.description ??
                  activeSection?.title ??
                  "继续阅读课程。"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-xl border border-black/8 bg-white p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                aria-label="复制公开链接"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void saveToLibrary()}
                disabled={isSavingCourse || data.viewer.role === "owner"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-panel-strong)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {savedCourseId ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                <span>
                  {isSavingCourse
                    ? "保存中"
                    : data.viewer.role === "owner"
                      ? "作者视图"
                      : savedCourseId
                        ? "进入我的学习库"
                        : "保存到我的学习库"}
                </span>
              </button>
            </div>
          </header>

          <div className="mobile-scroll min-h-[32rem] flex-1 overflow-y-auto lg:min-h-0">
            <article className="mx-auto w-full max-w-[780px] px-4 py-5 md:px-8 md:py-7 lg:px-10 lg:py-8">
              {activeSection ? (
                <section key={activeSection.nodeId} className="relative rounded-[28px]">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
                        当前小节
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                        {activeSection.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddAnnotation(activeSection.nodeId)}
                      className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      公共批注
                    </button>
                  </div>
                  {activeVisibleAnnotations.length > 0 ? (
                    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                      {activeVisibleAnnotations.map((annotation) => (
                        <button
                          key={annotation.id}
                          type="button"
                          onClick={() => focusAnnotation(annotation.id)}
                          className={cn(
                            "shrink-0 rounded-full border px-3 py-1.5 text-xs leading-none transition-colors",
                            activeAnnotationId === annotation.id
                              ? "border-amber-300/70 bg-amber-50 text-[var(--color-text)]"
                              : "border-black/[0.06] bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-text)]",
                          )}
                        >
                          {annotation.quotedText}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="relative">
                    <div
                      ref={(node) => {
                        articleContentRef.current = node;
                        if (node) {
                          sectionRefs.current.set(activeSection.nodeId, node);
                        }
                      }}
                      className="learn-prose border-b border-black/[0.05] pb-10 md:pb-12"
                    >
                      {activeSection.content ? (
                        <StreamdownMessage content={activeSection.content} />
                      ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          这一节还没有公开内容。
                        </p>
                      )}
                    </div>
                    {annotationHighlights.length > 0 ? (
                      <div className="pointer-events-none absolute inset-0">
                        {annotationHighlights.map((highlight) =>
                          highlight.rects.map((rect, rectIndex) => (
                            <button
                              key={`${highlight.annotationId}-${rectIndex}`}
                              type="button"
                              data-public-annotation-id={highlight.annotationId}
                              onClick={() => focusAnnotation(highlight.annotationId)}
                              aria-label="查看公共批注"
                              className={cn(
                                "pointer-events-auto absolute cursor-pointer rounded-[3px] border-none bg-amber-200/55 p-0 transition-colors hover:bg-amber-200/75",
                                activeAnnotationId === highlight.annotationId &&
                                  "bg-amber-300/75 ring-1 ring-amber-500/30",
                              )}
                              style={{
                                top: rect.top,
                                left: rect.left,
                                width: rect.width,
                                height: rect.height,
                              }}
                            />
                          )),
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : (
                <div className="py-10 text-sm text-[var(--color-text-secondary)]">暂无内容</div>
              )}

              {data.content.citations.length > 0 ? (
                <section className="mt-8">
                  <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
                    来源
                  </p>
                  <div className="mt-3 grid gap-2">
                    {data.content.citations.slice(0, 6).map((citation) => (
                      <a
                        key={citation.id}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-black/[0.06] bg-[var(--color-panel-soft)] px-4 py-3 transition-colors hover:bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                          <h4 className="line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
                            {citation.title}
                          </h4>
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                          {citation.domain}
                        </p>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          </div>
        </section>

        <aside className="min-h-0 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/82 shadow-[0_22px_64px_-50px_rgba(15,23,42,0.3)] backdrop-blur-xl lg:h-full">
          <div className="border-b border-black/[0.04] px-5 py-5">
            <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
              公共批注
            </p>
            <h2 className="mt-2 text-base font-semibold text-[var(--color-text)]">
              {visibleAnnotations.length} 条讨论
            </h2>
            {isOwnerView && hiddenAnnotationCount > 0 ? (
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                {hiddenAnnotationCount} 条已隐藏，仅作者可见。
              </p>
            ) : null}
          </div>

          <div className="mobile-scroll min-h-0 max-h-96 overflow-y-auto px-4 py-4 lg:max-h-none">
            <div className="space-y-3">
              {activeSectionAnnotations.map((annotation) => (
                <article
                  key={annotation.id}
                  className={cn(
                    "rounded-[22px] border px-4 py-3 transition-colors",
                    annotation.status === "hidden"
                      ? "border-dashed border-black/[0.08] bg-[var(--color-panel-soft)] opacity-75"
                      : "border-black/[0.05] bg-white/74",
                    activeAnnotationId === annotation.id &&
                      "border-amber-300/60 bg-amber-50/70 ring-1 ring-amber-300/35",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => focusAnnotation(annotation.id)}
                    className="block w-full rounded-2xl bg-[var(--color-panel-soft)] px-3 py-2 text-left text-xs leading-5 text-[var(--color-text-secondary)] transition-colors hover:bg-white"
                  >
                    <span className="line-clamp-2">“{annotation.quotedText}”</span>
                  </button>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
                    {annotation.body}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[0.625rem] text-[var(--color-text-tertiary)]">
                      {annotation.author.name ? `${annotation.author.name} · ` : ""}
                      {new Date(annotation.createdAt).toLocaleString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {annotation.status === "hidden" ? " · 已隐藏" : ""}
                    </p>
                    {isOwnerView ? (
                      <button
                        type="button"
                        onClick={() =>
                          void updateAnnotationStatus(
                            annotation,
                            annotation.status === "hidden" ? "visible" : "hidden",
                          )
                        }
                        disabled={moderatingAnnotationId === annotation.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          annotation.status === "hidden" ? "恢复公共批注" : "隐藏公共批注"
                        }
                      >
                        {annotation.status === "hidden" ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}

              {activeSectionAnnotations.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-black/[0.08] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  这一节还没有公共批注。
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {selectionDraft ? (
        <div className="ui-scrim fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-6 md:items-center md:px-0 md:pb-0 md:pt-0">
          <div className="ui-message-card safe-bottom w-[min(34rem,calc(100vw-1.5rem))] rounded-[28px] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">添加公共批注</h3>
            <p className="mt-3 rounded-xl bg-[var(--color-panel-soft)] px-3 py-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              “{selectionDraft.quotedText}”
            </p>
            <textarea
              value={annotationBody}
              onChange={(event) => setAnnotationBody(event.target.value)}
              placeholder="写下你的问题、补充或经验"
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--color-border)] p-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent-ring)]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectionDraft(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitAnnotation()}
                disabled={isSubmittingAnnotation || !annotationBody.trim()}
                className="ui-primary-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                发布
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

"use client";

import {
  Bell,
  BookOpenText,
  ChevronDown,
  Copy,
  ExternalLink,
  EyeOff,
  Heart,
  Link2,
  List,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { TextSelectionActionBar } from "@/components/course-reader/TextSelectionActionBar";
import { AppBackLink } from "@/components/shared/layout";
import { useToast } from "@/components/ui/Toast";
import { useTextAnchorHighlights } from "@/hooks/useTextAnchorHighlights";
import { stripLeadingSectionHeading, stripSectionNumber } from "@/lib/learning/content-formatting";
import type {
  PublicCourseAnnotationProjection,
  PublicCourseReaderProjection,
} from "@/lib/learning/course-sharing-types";
import {
  createPublicAnnotation,
  mergePublicAnnotationMutation,
  submitPublicCourseUrge,
  subscribePublicCourse,
  togglePublicCourseLike,
  updatePublicAnnotationStatus,
} from "@/lib/learning/public-course-client";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

interface PublicCourseReaderProps {
  data: PublicCourseReaderProjection;
}

type PublicOutlineChapter = PublicCourseReaderProjection["content"]["outline"]["chapters"][number];

interface SelectionDraft {
  sectionKey: string;
  quotedText: string;
  anchor: PublicCourseAnnotationProjection["anchor"];
}

const EMPTY_PUBLIC_ANNOTATIONS: PublicCourseAnnotationProjection[] = [];

function getChapterKey(chapterTitle: string, chapterIndex: number): string {
  return `${chapterIndex}:${chapterTitle}`;
}

function getSectionChapterKey(chapters: PublicOutlineChapter[], sectionKey: string): string | null {
  const chapterIndex = chapters.findIndex((chapter) =>
    chapter.sections.some((section) => section.nodeId === sectionKey),
  );

  if (chapterIndex < 0) {
    return null;
  }

  return getChapterKey(chapters[chapterIndex].title, chapterIndex);
}

export function PublicCourseReader({ data }: PublicCourseReaderProps) {
  const { addToast } = useToast();
  const [activeSectionKey, setActiveSectionKey] = useState(
    () => data.content.outline.chapters[0]?.sections[0]?.nodeId ?? "",
  );
  const [annotations, setAnnotations] = useState(data.annotations);
  const [subscription, setSubscription] = useState(data.subscription);
  const [liked, setLiked] = useState(data.viewer.liked);
  const [urged, setUrged] = useState(data.viewer.urged);
  const [likesCount, setLikesCount] = useState(data.engagement.likesCount);
  const [urgesCount, setUrgesCount] = useState(data.engagement.urgesCount);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [isSubmittingAnnotation, setIsSubmittingAnnotation] = useState(false);
  const [isSubscribingCourse, setIsSubscribingCourse] = useState(false);
  const [moderatingAnnotationId, setModeratingAnnotationId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"outline" | "annotations" | null>(null);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [expandedChapterKeys, setExpandedChapterKeys] = useState<Set<string>>(
    () =>
      new Set(
        data.content.outline.chapters[0]
          ? [getChapterKey(data.content.outline.chapters[0].title, 0)]
          : [],
      ),
  );
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
  const activeChapterIndex = data.content.outline.chapters.findIndex((chapter) =>
    chapter.sections.some((section) => section.nodeId === activeSectionKey),
  );
  const activeChapter =
    activeChapterIndex >= 0 ? data.content.outline.chapters[activeChapterIndex] : null;
  const activeOutlineSection =
    activeChapter?.sections.find((section) => section.nodeId === activeSectionKey) ?? null;
  const activeSectionTitle = activeOutlineSection?.title ?? activeSection?.title ?? "未命名小节";
  const activeSectionIntro =
    activeOutlineSection?.description.trim() || activeChapter?.description.trim() || "";
  const activeSectionOrderByKey = useMemo(() => {
    const map = new Map<string, number>();
    let order = 1;

    for (const chapter of data.content.outline.chapters) {
      for (const section of chapter.sections) {
        map.set(section.nodeId, order);
        order += 1;
      }
    }

    return map;
  }, [data.content.outline.chapters]);
  const activeSectionOrder = activeSectionOrderByKey.get(activeSectionKey) ?? 0;
  const activeSectionContent = activeSection?.content
    ? stripLeadingSectionHeading(activeSection.content, activeSectionTitle)
    : "";
  const annotationHighlightItems = useMemo(
    () =>
      activeVisibleAnnotations.map((annotation) => ({
        id: annotation.id,
        anchor: annotation.anchor,
        quotedText: annotation.quotedText,
      })),
    [activeVisibleAnnotations],
  );
  const annotationHighlights = useTextAnchorHighlights({
    containerRef: articleContentRef,
    items: annotationHighlightItems,
  });

  useEffect(() => {
    if (!mobilePanel && !isMobileToolsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobilePanel(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileToolsOpen, mobilePanel]);

  const copyLink = async () => {
    const result = await copyTextToClipboard(window.location.href);
    if (result === "failed") {
      addToast("复制受浏览器限制，请从地址栏复制链接", "warning");
      return;
    }

    addToast("已复制公开链接", "success");
  };

  const focusAnnotation = (annotationId: string) => {
    setActiveAnnotationId(annotationId);
    setMobilePanel(null);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-public-annotation-id="${annotationId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  };

  const selectSection = (sectionKey: string) => {
    setActiveSectionKey(sectionKey);
    const chapterKey = getSectionChapterKey(data.content.outline.chapters, sectionKey);
    if (chapterKey) {
      setExpandedChapterKeys((current) => {
        if (current.has(chapterKey)) {
          return current;
        }

        return new Set([...current, chapterKey]);
      });
    }
    setMobilePanel(null);
  };

  const selectChapter = (chapterKey: string, sectionKey?: string) => {
    if (sectionKey && sectionKey !== activeSectionKey) {
      setActiveSectionKey(sectionKey);
    }

    setExpandedChapterKeys(new Set([chapterKey]));
  };

  const startComment = (draft: SelectionDraft) => {
    if (!data.capabilities.canAnnotatePublicly) {
      addToast("登录后可以发表评论", "info");
      return;
    }

    setSelectionDraft(draft);
    setAnnotationBody("");
  };

  const toggleLike = async () => {
    if (!data.viewer.userId) {
      window.location.assign(
        `/login?callbackUrl=${encodeURIComponent(`/c/${data.publication.slug}`)}`,
      );
      return;
    }

    try {
      const result = await togglePublicCourseLike({
        publicationSlug: data.publication.slug,
      });
      setLiked(result.liked);
      setLikesCount((count) => Math.max(0, count + (result.liked ? 1 : -1)));
    } catch {
      addToast("\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5", "error");
    }
  };

  const toggleUrge = async () => {
    if (!data.viewer.userId) {
      window.location.assign(
        `/login?callbackUrl=${encodeURIComponent(`/c/${data.publication.slug}`)}`,
      );
      return;
    }

    try {
      const result = await submitPublicCourseUrge({
        publicationSlug: data.publication.slug,
      });
      setUrged(result.urged);
      setUrgesCount((count) => Math.max(0, count + (result.urged ? 1 : -1)));
    } catch {
      addToast("\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5", "error");
    }
  };

  const subscribeAndStart = async () => {
    if (subscription.learnUrl) {
      window.location.assign(subscription.learnUrl);
      return;
    }

    if (!data.viewer.userId) {
      window.location.assign(
        `/login?callbackUrl=${encodeURIComponent(`/c/${data.publication.slug}`)}`,
      );
      return;
    }

    setIsSubscribingCourse(true);

    try {
      const payload = await subscribePublicCourse({
        publicationSlug: data.publication.slug,
      });

      setSubscription({
        active: true,
        learnUrl: payload.learnUrl,
      });

      window.location.replace(payload.learnUrl);
    } catch {
      addToast("订阅失败，请稍后重试", "error");
      setIsSubscribingCourse(false);
    }
  };

  const updateAnnotationStatus = async (
    annotation: PublicCourseAnnotationProjection,
    status: PublicCourseAnnotationProjection["status"],
  ) => {
    setModeratingAnnotationId(annotation.id);

    try {
      const payload = await updatePublicAnnotationStatus<PublicCourseAnnotationProjection>({
        publicationSlug: data.publication.slug,
        annotationId: annotation.id,
        status,
      });
      const nextAnnotation = mergePublicAnnotationMutation(annotation, payload, status);

      setAnnotations((current) =>
        current.map((item) => (item.id === annotation.id ? nextAnnotation : item)),
      );
      addToast(status === "hidden" ? "评论已隐藏" : "评论已恢复", "success");
    } catch {
      addToast("更新评论失败，请稍后重试", "error");
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
      const payload = await createPublicAnnotation<PublicCourseAnnotationProjection>({
        publicationSlug: data.publication.slug,
        ...selectionDraft,
        body: annotationBody.trim(),
      });
      if (payload.annotation) {
        setAnnotations((current) => [
          ...current,
          payload.annotation as PublicCourseAnnotationProjection,
        ]);
      }

      addToast("评论已发布", "success");
      setSelectionDraft(null);
      setAnnotationBody("");
    } catch {
      addToast("发布评论失败，请稍后重试", "error");
    } finally {
      setIsSubmittingAnnotation(false);
    }
  };

  const outlinePanel = (
    <>
      <div className="border-b border-black/[0.04] px-4 pb-5 pt-5 lg:px-5">
        <div className="flex items-center justify-between gap-3">
          <AppBackLink target={PAGE_BACK_TARGETS.publicCourse} variant="pill" />
          <span className="rounded-full bg-black/[0.035] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">
            公开课
          </span>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
            当前小节
          </div>
          <div className="line-clamp-3 text-[0.98rem] font-semibold leading-snug text-[var(--color-text)]">
            {stripSectionNumber(activeSectionTitle)}
          </div>
          {activeChapter ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
              第 {activeChapterIndex + 1} 章 · {stripSectionNumber(activeChapter.title)}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-1 text-[0.6875rem] leading-5 text-[var(--color-text-tertiary)]">
            来自 {data.content.course.title}
          </p>
        </div>

        <div className="mt-4 flex items-center rounded-full bg-[var(--color-panel-soft)] px-3 py-2 text-[0.6875rem] leading-none text-[var(--color-text-tertiary)]">
          <span>{activeChapterIndex >= 0 ? `第 ${activeChapterIndex + 1} 章` : "章节"}</span>
          {activeSectionOrder > 0 ? (
            <>
              <span className="mx-2 h-3 w-px bg-black/[0.08]" aria-hidden="true" />
              <span>
                第 {activeSectionOrder}/{totalSections} 节
              </span>
            </>
          ) : null}
          {activeSectionAnnotations.length > 0 ? (
            <>
              <span className="mx-2 h-3 w-px bg-black/[0.08]" aria-hidden="true" />
              <span>{activeSectionAnnotations.length} 评论</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <div className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
            目录
          </div>
          {visibleAnnotations.length > 0 ? (
            <div className="text-[0.625rem] text-[var(--color-text-tertiary)]">
              {visibleAnnotations.length} 评论
            </div>
          ) : null}
        </div>
        <div className="space-y-1">
          {data.content.outline.chapters.map((chapter, chapterIndex) => {
            const chapterKey = getChapterKey(chapter.title, chapterIndex);
            const isExpanded = expandedChapterKeys.has(chapterKey);
            const isCurrentChapter = chapterIndex === activeChapterIndex;
            const chapterAnnotationCount = chapter.sections.reduce(
              (total, section) =>
                total + (visibleAnnotationsBySection.get(section.nodeId)?.length ?? 0),
              0,
            );

            return (
              <section key={chapterKey}>
                <button
                  type="button"
                  onClick={() => selectChapter(chapterKey, chapter.sections[0]?.nodeId)}
                  className={cn(
                    "group w-full rounded-xl px-2 py-2 text-left transition-colors duration-200",
                    isCurrentChapter
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "h-5 w-px shrink-0 rounded-full transition-colors",
                        isCurrentChapter
                          ? "bg-[var(--color-text)]"
                          : "bg-transparent group-hover:bg-black/10",
                      )}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "line-clamp-2 text-[0.84rem] leading-snug",
                          isCurrentChapter ? "font-semibold" : "font-medium",
                        )}
                      >
                        {stripSectionNumber(chapter.title)}
                      </div>
                      <div className="mt-1 text-[0.625rem] leading-none text-[var(--color-text-muted)]">
                        {chapter.sections.length} 节
                        {chapterAnnotationCount > 0 ? ` · ${chapterAnnotationCount} 评论` : ""}
                      </div>
                    </div>

                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-text-tertiary)] transition-colors group-hover:text-[var(--color-text-secondary)]">
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          !isExpanded && "-rotate-90",
                        )}
                      />
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="ml-[0.5rem] overflow-hidden border-l border-black/[0.06] py-1 pl-3">
                    <div className="space-y-0.5">
                      {chapter.sections.map((section) => {
                        const active = section.nodeId === activeSectionKey;
                        const annotationCount =
                          visibleAnnotationsBySection.get(section.nodeId)?.length ?? 0;

                        return (
                          <button
                            key={section.nodeId}
                            type="button"
                            onClick={() => selectSection(section.nodeId)}
                            className={cn(
                              "relative w-full rounded-lg px-2 py-1.5 text-left text-[0.8125rem] transition-colors",
                              active
                                ? "text-[var(--color-text)]"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute -left-[13px] top-2 bottom-2 w-px rounded-full transition-colors",
                                active ? "bg-[var(--color-text)]" : "bg-transparent",
                              )}
                              aria-hidden="true"
                            />
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "block min-w-0 flex-1 truncate",
                                  active ? "font-semibold" : "font-medium",
                                )}
                              >
                                {stripSectionNumber(section.title)}
                              </span>
                              {annotationCount > 0 ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-[0.625rem] leading-none text-[var(--color-text-muted)]">
                                  <MessageSquareText className="h-3 w-3" />
                                  {annotationCount}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );

  const annotationsPanel = (
    <>
      <div className="border-b border-black/[0.06] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">评论</h2>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {activeSectionAnnotations.length}/{visibleAnnotations.length}
          </span>
        </div>
        {isOwnerView && hiddenAnnotationCount > 0 ? (
          <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-secondary)]">
            {hiddenAnnotationCount} 条已隐藏，仅作者可见。
          </p>
        ) : null}
      </div>

      <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          {activeSectionAnnotations.map((annotation) => (
            <article
              key={annotation.id}
              className={cn(
                "border-l-2 px-3 py-3 transition-colors",
                annotation.status === "hidden"
                  ? "border-black/[0.12] bg-black/[0.018] opacity-75"
                  : "border-black/[0.08]",
                activeAnnotationId === annotation.id &&
                  "border-amber-400/75 bg-amber-50/60 ring-1 ring-amber-300/20",
              )}
            >
              <button
                type="button"
                onClick={() => focusAnnotation(annotation.id)}
                className="block w-full text-left text-xs leading-5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
              >
                <span className="line-clamp-2">“{annotation.quotedText}”</span>
              </button>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">{annotation.body}</p>
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
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={annotation.status === "hidden" ? "恢复评论" : "隐藏评论"}
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
            <div className="px-3 py-8 text-sm leading-6 text-[var(--color-text-secondary)]">
              这一节还没有评论。
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <main className="min-h-dvh overflow-hidden bg-[#f4f5f5] text-[var(--color-text)]">
      <div className="grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-[17.5rem_minmax(0,1fr)_21rem]">
        <aside className="hidden min-h-0 border-black/[0.06] bg-white/95 lg:flex lg:h-full lg:flex-col lg:border-r">
          {outlinePanel}
        </aside>

        <section className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          <header className="safe-top sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b border-black/[0.06] bg-white/96 px-5 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:static lg:px-7">
            <div className="min-w-0">
              <div className="line-clamp-1 text-sm font-semibold text-[var(--color-text)] lg:hidden">
                {stripSectionNumber(activeSectionTitle)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)] lg:mt-0">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenText className="h-3.5 w-3.5" />
                  {activeChapterIndex >= 0 ? `第 ${activeChapterIndex + 1} 章` : "章节"}
                </span>
                {activeSectionOrder > 0 ? (
                  <span>
                    第 {activeSectionOrder}/{totalSections} 节
                  </span>
                ) : null}
                {activeSectionAnnotations.length > 0 ? (
                  <span>{activeSectionAnnotations.length} 条评论</span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-lg border border-black/8 bg-white p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                aria-label="复制公开链接"
                title="复制公开链接"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void toggleLike()}
                aria-pressed={liked}
                aria-label={liked ? "取消点赞" : "点赞"}
                className={cn(
                  "inline-flex min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                  liked
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-black/8 bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                )}
                title={liked ? "取消点赞" : "点赞"}
              >
                <Heart className={cn("h-3.5 w-3.5", liked && "fill-red-500")} />
                {likesCount > 0 ? <span>{likesCount}</span> : null}
              </button>
              <button
                type="button"
                onClick={() => void toggleUrge()}
                aria-pressed={urged}
                aria-label={urged ? "取消催更" : "催更"}
                className={cn(
                  "inline-flex min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                  urged
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-black/8 bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                )}
                title={urged ? "取消催更" : "催更"}
              >
                <Bell className={cn("h-3.5 w-3.5", urged && "fill-amber-500")} />
                {urgesCount > 0 ? <span>{urgesCount}</span> : null}
              </button>
              <button
                type="button"
                onClick={() => void subscribeAndStart()}
                disabled={isSubscribingCourse || data.viewer.role === "owner"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-panel-strong)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {subscription.active ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                <span>
                  {isSubscribingCourse
                    ? "订阅中"
                    : data.viewer.role === "owner"
                      ? "作者视图"
                      : subscription.active
                        ? "进入学习"
                        : "订阅学习"}
                </span>
              </button>
            </div>
          </header>

          <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto">
            <article className="mx-auto w-full max-w-[860px] px-5 pb-20 pt-7 md:px-10 md:py-9 lg:px-12 lg:py-10">
              {activeSection ? (
                <section key={activeSection.nodeId} className="relative">
                  <div className="mb-7 flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      {activeChapter ? (
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)]">
                          <span>第 {activeChapterIndex + 1} 章</span>
                          <span className="h-1 w-1 rounded-full bg-black/20" aria-hidden="true" />
                          <span className="line-clamp-1">
                            {stripSectionNumber(activeChapter.title)}
                          </span>
                        </div>
                      ) : null}
                      <h1 className="text-[2rem] font-semibold leading-tight text-[var(--color-text)] md:text-[2.15rem]">
                        {stripSectionNumber(activeSectionTitle)}
                      </h1>
                      {activeSectionIntro ? (
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                          {activeSectionIntro}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {activeVisibleAnnotations.length > 0 ? (
                    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                      {activeVisibleAnnotations.map((annotation) => (
                        <button
                          key={annotation.id}
                          type="button"
                          onClick={() => focusAnnotation(annotation.id)}
                          className={cn(
                            "shrink-0 rounded-lg border px-2.5 py-1.5 text-xs leading-none transition-colors",
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
                    <div ref={articleContentRef} className="learn-prose pb-10 md:pb-12">
                      {activeSectionContent ? (
                        <StreamdownMessage
                          content={activeSectionContent}
                          variant="reader"
                          controls={{ code: false, mermaid: false, table: false }}
                        />
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
                              key={`${highlight.id}-${rectIndex}`}
                              type="button"
                              data-public-annotation-id={highlight.id}
                              onClick={() => focusAnnotation(highlight.id)}
                              aria-label="查看评论"
                              className={cn(
                                "pointer-events-auto absolute cursor-pointer rounded-[3px] border-none bg-amber-200/55 p-0 transition-colors hover:bg-amber-200/75",
                                activeAnnotationId === highlight.id &&
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
                    <TextSelectionActionBar
                      containerRef={articleContentRef}
                      contextRadius={80}
                      actions={[
                        {
                          label: "评论",
                          icon: MessageSquare,
                          variant: "primary",
                          onSelect: ({ anchor, selectedText }) => {
                            startComment({
                              sectionKey: activeSection.nodeId,
                              quotedText: selectedText,
                              anchor,
                            });
                          },
                        },
                      ]}
                    />
                  </div>
                </section>
              ) : (
                <div className="py-10 text-sm text-[var(--color-text-secondary)]">暂无内容</div>
              )}

              {data.content.citations.length > 0 ? (
                <section className="mt-10 border-t border-black/[0.06] pt-6">
                  <p className="text-[0.625rem] font-semibold text-[var(--color-text-muted)]">
                    来源
                  </p>
                  <div className="mt-3 grid gap-2">
                    {data.content.citations.slice(0, 6).map((citation) => (
                      <a
                        key={citation.id}
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-black/[0.06] bg-[var(--color-panel-soft)] px-4 py-3 transition-colors hover:bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                          <h3 className="line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
                            {citation.title}
                          </h3>
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

        <aside className="hidden min-h-0 border-black/[0.06] bg-[#fafafa] lg:flex lg:h-full lg:flex-col lg:border-l">
          {annotationsPanel}
        </aside>

        <div className="safe-bottom fixed right-3 bottom-4 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileToolsOpen(true)}
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/92 text-[var(--color-text-secondary)] shadow-[0_14px_38px_-26px_rgba(15,23,42,0.42)] backdrop-blur-xl transition-colors hover:text-[var(--color-text)]"
            aria-label="打开工具"
            title="工具"
          >
            <MoreHorizontal className="h-5 w-5" />
            {activeSectionAnnotations.length > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-md bg-[var(--color-panel-strong)] px-1 text-[0.625rem] leading-4 text-white">
                {activeSectionAnnotations.length}
              </span>
            ) : null}
          </button>
        </div>

        {isMobileToolsOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="关闭工具"
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setIsMobileToolsOpen(false)}
            />
            <aside className="ui-message-card safe-bottom absolute inset-x-3 bottom-3 rounded-[28px] p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-xs font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
                  工具
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileToolsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      void toggleLike();
                    }}
                    aria-pressed={liked}
                    aria-label={liked ? "取消点赞" : "点赞"}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-medium transition-colors",
                      liked
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-black/8 bg-white text-[var(--color-text-secondary)]",
                    )}
                  >
                    <Heart className={cn("h-3.5 w-3.5", liked && "fill-red-500")} />
                    {likesCount > 0 ? <span>{likesCount}</span> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      void toggleUrge();
                    }}
                    aria-pressed={urged}
                    aria-label={urged ? "取消催更" : "催更"}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-medium transition-colors",
                      urged
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-black/8 bg-white text-[var(--color-text-secondary)]",
                    )}
                  >
                    <Bell className={cn("h-3.5 w-3.5", urged && "fill-amber-500")} />
                    {urgesCount > 0 ? <span>{urgesCount}</span> : null}
                  </button>
                </div>
                {[
                  {
                    label: "目录",
                    meta: "章节",
                    icon: List,
                    onClick: () => setMobilePanel("outline"),
                    disabled: false,
                  },
                  {
                    label: "评论",
                    meta:
                      activeSectionAnnotations.length > 0
                        ? `${activeSectionAnnotations.length} 条`
                        : "当前小节",
                    icon: MessageSquareText,
                    onClick: () => setMobilePanel("annotations"),
                    disabled: false,
                  },
                  {
                    label:
                      data.viewer.role === "owner"
                        ? "作者视图"
                        : subscription.active
                          ? "进入学习"
                          : "订阅学习",
                    meta: subscription.active ? "最新公开版本" : "同步作者更新",
                    icon: MessageSquare,
                    onClick: () => void subscribeAndStart(),
                    disabled: isSubscribingCourse || data.viewer.role === "owner",
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      item.onClick();
                    }}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[var(--color-panel-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--color-text)]">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">
                        {item.meta}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        {mobilePanel ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="关闭面板"
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setMobilePanel(null)}
            />
            <aside className="safe-bottom absolute inset-y-0 right-0 flex w-[min(88vw,23rem)] flex-col overflow-hidden border-l border-black/[0.08] bg-white shadow-[0_24px_84px_-42px_rgba(15,23,42,0.45)]">
              <div className="safe-top flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  {mobilePanel === "outline" ? "目录" : "评论"}
                </h2>
                <button
                  type="button"
                  onClick={() => setMobilePanel(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {mobilePanel === "outline" ? outlinePanel : annotationsPanel}
            </aside>
          </div>
        ) : null}
      </div>

      {selectionDraft ? (
        <div className="ui-scrim fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-6 md:items-center md:px-0 md:pb-0 md:pt-0">
          <div className="ui-message-card safe-bottom w-[min(34rem,calc(100vw-1.5rem))] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">发表评论</h3>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useTextAnchorHighlights } from "@/hooks/useTextAnchorHighlights";
import { stripLeadingSectionHeading } from "@/lib/learning/content-formatting";
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
import { copyTextToClipboard } from "@/lib/utils/clipboard";

type PublicOutlineChapter = PublicCourseReaderProjection["content"]["outline"]["chapters"][number];

export interface PublicCourseSelectionDraft {
  sectionKey: string;
  quotedText: string;
  anchor: PublicCourseAnnotationProjection["anchor"];
}

const EMPTY_PUBLIC_ANNOTATIONS: PublicCourseAnnotationProjection[] = [];

export function getPublicChapterKey(chapterTitle: string, chapterIndex: number): string {
  return `${chapterIndex}:${chapterTitle}`;
}

function getSectionChapterKey(chapters: PublicOutlineChapter[], sectionKey: string): string | null {
  const chapterIndex = chapters.findIndex((chapter) =>
    chapter.sections.some((section) => section.nodeId === sectionKey),
  );
  return chapterIndex < 0 ? null : getPublicChapterKey(chapters[chapterIndex].title, chapterIndex);
}

export function usePublicCourseReaderController(data: PublicCourseReaderProjection) {
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
  const [selectionDraft, setSelectionDraft] = useState<PublicCourseSelectionDraft | null>(null);
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
          ? [getPublicChapterKey(data.content.outline.chapters[0].title, 0)]
          : [],
      ),
  );
  const articleContentRef = useRef<HTMLDivElement | null>(null);
  const isOwnerView = data.capabilities.canModeratePublicAnnotations;
  const visibleAnnotations = annotations.filter((annotation) => annotation.status === "visible");
  const displayAnnotations = isOwnerView ? annotations : visibleAnnotations;
  const annotationsBySection = new Map<string, PublicCourseAnnotationProjection[]>();
  const visibleAnnotationsBySection = new Map<string, PublicCourseAnnotationProjection[]>();

  for (const annotation of displayAnnotations) {
    annotationsBySection.set(annotation.sectionKey, [
      ...(annotationsBySection.get(annotation.sectionKey) ?? []),
      annotation,
    ]);
  }
  for (const annotation of visibleAnnotations) {
    visibleAnnotationsBySection.set(annotation.sectionKey, [
      ...(visibleAnnotationsBySection.get(annotation.sectionKey) ?? []),
      annotation,
    ]);
  }

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
  const activeSectionOrderByKey = new Map<string, number>();
  let sectionOrder = 1;
  for (const chapter of data.content.outline.chapters) {
    for (const section of chapter.sections) {
      activeSectionOrderByKey.set(section.nodeId, sectionOrder);
      sectionOrder += 1;
    }
  }
  const activeSectionOrder = activeSectionOrderByKey.get(activeSectionKey) ?? 0;
  const activeSectionContent = activeSection?.content
    ? stripLeadingSectionHeading(activeSection.content, activeSectionTitle)
    : "";
  const annotationHighlights = useTextAnchorHighlights({
    containerRef: articleContentRef,
    items: activeVisibleAnnotations.map((annotation) => ({
      id: annotation.id,
      anchor: annotation.anchor,
      quotedText: annotation.quotedText,
    })),
  });

  useEffect(() => {
    if (!mobilePanel && !isMobileToolsOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobilePanel(null);
        setIsMobileToolsOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileToolsOpen, mobilePanel]);

  const copyLink = async () => {
    const result = await copyTextToClipboard(window.location.href);
    addToast(
      result === "failed" ? "复制受浏览器限制，请从地址栏复制链接" : "已复制公开链接",
      result === "failed" ? "warning" : "success",
    );
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
      setExpandedChapterKeys((current) =>
        current.has(chapterKey) ? current : new Set([...current, chapterKey]),
      );
    }
    setMobilePanel(null);
  };

  const selectChapter = (chapterKey: string, sectionKey?: string) => {
    if (sectionKey && sectionKey !== activeSectionKey) setActiveSectionKey(sectionKey);
    setExpandedChapterKeys(new Set([chapterKey]));
  };

  const startComment = (draft: PublicCourseSelectionDraft) => {
    if (!data.capabilities.canAnnotatePublicly) {
      addToast("登录后可以发表评论", "info");
      return;
    }
    setSelectionDraft(draft);
    setAnnotationBody("");
  };

  const requireViewer = (): boolean => {
    if (data.viewer.userId) return true;
    window.location.assign(
      `/login?callbackUrl=${encodeURIComponent(`/c/${data.publication.slug}`)}`,
    );
    return false;
  };

  const toggleLike = async () => {
    if (!requireViewer()) return;
    try {
      const result = await togglePublicCourseLike({ publicationSlug: data.publication.slug });
      setLiked(result.liked);
      setLikesCount((count) => Math.max(0, count + (result.liked ? 1 : -1)));
    } catch {
      addToast("操作失败，请稍后重试", "error");
    }
  };

  const toggleUrge = async () => {
    if (!requireViewer()) return;
    try {
      const result = await submitPublicCourseUrge({ publicationSlug: data.publication.slug });
      setUrged(result.urged);
      setUrgesCount((count) => Math.max(0, count + (result.urged ? 1 : -1)));
    } catch {
      addToast("操作失败，请稍后重试", "error");
    }
  };

  const subscribeAndStart = async () => {
    if (subscription.learnUrl) {
      window.location.assign(subscription.learnUrl);
      return;
    }
    if (!requireViewer()) return;
    setIsSubscribingCourse(true);
    try {
      const payload = await subscribePublicCourse({ publicationSlug: data.publication.slug });
      setSubscription({ active: true, learnUrl: payload.learnUrl });
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
    if (!selectionDraft || !annotationBody.trim()) return;
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

  return {
    activeSectionKey,
    annotations,
    subscription,
    liked,
    urged,
    likesCount,
    urgesCount,
    selectionDraft,
    setSelectionDraft,
    annotationBody,
    setAnnotationBody,
    activeAnnotationId,
    isSubmittingAnnotation,
    isSubscribingCourse,
    moderatingAnnotationId,
    mobilePanel,
    setMobilePanel,
    isMobileToolsOpen,
    setIsMobileToolsOpen,
    expandedChapterKeys,
    articleContentRef,
    isOwnerView,
    visibleAnnotations,
    visibleAnnotationsBySection,
    activeSection,
    activeSectionAnnotations,
    activeVisibleAnnotations,
    hiddenAnnotationCount,
    totalSections,
    activeChapterIndex,
    activeChapter,
    activeSectionTitle,
    activeSectionIntro,
    activeSectionOrder,
    activeSectionContent,
    annotationHighlights,
    copyLink,
    focusAnnotation,
    selectSection,
    selectChapter,
    startComment,
    toggleLike,
    toggleUrge,
    subscribeAndStart,
    updateAnnotationStatus,
    submitAnnotation,
  };
}

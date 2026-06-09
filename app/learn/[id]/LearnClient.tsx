// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { List, MessageSquare, MessageSquareText } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CoursePublishControl } from "@/components/course-reader/CoursePublishControl";
import { AppBackLink } from "@/components/shared/layout";
import { useChapterSections } from "@/hooks/useChapterSections";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { LearnPageProjection, LearnResumeState } from "@/lib/learning/projection";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

import { LearnChat } from "./components/LearnChat";
import { LearnSidebar } from "./components/LearnSidebar";
import { SectionReader } from "./components/SectionReader";

export interface LearnClientProps
  extends Pick<
      LearnPageProjection,
      | "courseTitle"
      | "courseDescription"
      | "difficulty"
      | "estimatedMinutes"
      | "learningOutcome"
      | "targetAudience"
      | "chapters"
      | "sectionDocs"
      | "publicAnnotations"
    >,
    Pick<
      LearnResumeState,
      "initialChapterIndex" | "initialCompletedSections" | "scrollToSectionId"
    > {
  sessionId: string;
}

const SIDEBAR_WIDTH = 288;

export function LearnClient({
  sessionId,
  courseTitle,
  chapters,
  sectionDocs,
  publicAnnotations,
  initialChapterIndex,
  initialCompletedSections,
  scrollToSectionId,
}: LearnClientProps) {
  const setCourseId = useLearnStore((s) => s.setCourseId);
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const expandChapter = useLearnStore((s) => s.expandChapter);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);
  const isSidebarOpen = useLearnStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useLearnStore((s) => s.setSidebarOpen);
  const isChatOpen = useLearnStore((s) => s.isChatOpen);
  const setChatOpen = useLearnStore((s) => s.setChatOpen);
  const isNotesOpen = useLearnStore((s) => s.isNotesOpen);
  const setNotesOpen = useLearnStore((s) => s.setNotesOpen);
  const currentSectionAnnotationCount = useLearnStore((s) => s.currentSectionAnnotationCount);
  const isDesktopSidebarCollapsed = useLearnStore((s) => s.isDesktopSidebarCollapsed);
  const setDesktopSidebarCollapsed = useLearnStore((s) => s.setDesktopSidebarCollapsed);
  const isDesktopChatCollapsed = useLearnStore((s) => s.isDesktopChatCollapsed);
  const setDesktopChatCollapsed = useLearnStore((s) => s.setDesktopChatCollapsed);

  const isMobile = useIsMobile();

  // Initialize store on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialization effect, runs once on mount
  useEffect(() => {
    // Set chapter index BEFORE loading chapters to avoid triggering PATCH
    setCurrentChapterIndex(initialChapterIndex);
    setCourseId(sessionId);
    setChapters(chapters);
    setSidebarOpen(false);
    setChatOpen(false);
    setNotesOpen(false);
    setDesktopSidebarCollapsed(false);
    setDesktopChatCollapsed(true);

    // Initialize completed sections
    for (const nodeId of initialCompletedSections) {
      markSectionComplete(nodeId);
    }

    // Keep the active chapter visible in the table of contents.
    expandChapter(initialChapterIndex);
  }, []); // Run once on mount

  const currentChapter = chapters[currentChapterIndex];

  // Build initialContent map for the current chapter's sections
  const initialContent = useMemo(() => {
    const map = new Map<string, { content: string; documentId: string }>();
    for (const doc of sectionDocs) {
      if (doc.content && doc.outlineNodeKey) {
        map.set(doc.outlineNodeKey, { content: doc.content, documentId: doc.id });
      }
    }
    return map;
  }, [sectionDocs]);
  // Section generation hook
  const { sections, currentGenerating, generateSection } = useChapterSections({
    courseId: sessionId,
    chapterIndex: currentChapterIndex,
    sectionCount: currentChapter?.sections.length ?? 0,
    initialContent,
  });

  // Close transient panels on ESC without changing the reading layout.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setChatOpen(false);
        setNotesOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setChatOpen, setNotesOpen, setSidebarOpen]);

  // Lock body scroll when overlay is open (mobile)
  useEffect(() => {
    if (!isMobile) return;
    if (isSidebarOpen || isChatOpen || isNotesOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobile, isSidebarOpen, isChatOpen, isNotesOpen]);

  // ─── Mobile layout ───
  if (isMobile) {
    return (
      <div className="ui-page-shell flex min-h-dvh flex-col safe-bottom">
        {/* Mobile header */}
        <header className="safe-top sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 bg-white/90 px-4 pb-2 pt-3 backdrop-blur-xl">
          <AppBackLink target={PAGE_BACK_TARGETS.learn} />
          <div className="min-w-0 flex-1 text-center text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            <span className="line-clamp-1">{courseTitle}</span>
          </div>
          <div className="h-9 w-9" />
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-hidden bg-white">
          <SectionReader
            courseId={sessionId}
            sections={sections}
            currentGenerating={currentGenerating}
            generateSection={generateSection}
            sectionDocs={sectionDocs}
            publicAnnotations={publicAnnotations}
            scrollToSectionId={scrollToSectionId}
          />
        </div>

        <nav className="safe-bottom fixed right-3 bottom-4 z-30 flex flex-col gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white/92 text-[var(--color-text-secondary)] shadow-[0_14px_38px_-26px_rgba(15,23,42,0.42)] backdrop-blur-xl transition-colors",
              isSidebarOpen
                ? "bg-[var(--color-panel-strong)] text-white"
                : "hover:text-[var(--color-text)]",
            )}
            aria-label="打开目录"
            title="目录"
          >
            <List className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white/92 text-[var(--color-text-secondary)] shadow-[0_14px_38px_-26px_rgba(15,23,42,0.42)] backdrop-blur-xl transition-colors",
              isChatOpen
                ? "bg-[var(--color-panel-strong)] text-white"
                : "hover:text-[var(--color-text)]",
            )}
            aria-label="打开对话"
            title="对话"
          >
            <MessageSquare className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className={cn(
              "relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white/92 text-[var(--color-text-secondary)] shadow-[0_14px_38px_-26px_rgba(15,23,42,0.42)] backdrop-blur-xl transition-colors",
              isNotesOpen
                ? "bg-[var(--color-panel-strong)] text-white"
                : "hover:text-[var(--color-text)]",
            )}
            aria-label="打开评论"
            title="评论"
          >
            <MessageSquareText className="h-4.5 w-4.5" />
            {currentSectionAnnotationCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-md bg-[var(--color-panel-strong)] px-1 text-[0.625rem] leading-4 text-white">
                {currentSectionAnnotationCount}
              </span>
            ) : null}
          </button>
        </nav>

        {/* Sidebar overlay - slide from left */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ui-scrim-strong fixed inset-0 z-40 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -SIDEBAR_WIDTH }}
                animate={{ x: 0 }}
                exit={{ x: -SIDEBAR_WIDTH }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="ui-page-shell fixed inset-y-0 left-0 z-50 w-[min(88vw,288px)] overflow-hidden rounded-r-[28px] shadow-xl"
              >
                <LearnSidebar courseTitle={courseTitle} width={SIDEBAR_WIDTH} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Chat overlay - slide from right */}
        <AnimatePresence>
          {isChatOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ui-scrim-strong fixed inset-0 z-40 backdrop-blur-sm"
                onClick={() => setChatOpen(false)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="ui-page-shell fixed inset-y-0 right-0 z-50 w-full overflow-hidden shadow-xl"
              >
                <LearnChat courseId={sessionId} courseTitle={courseTitle} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="ui-page-shell min-h-dvh overflow-hidden">
      <div
        className={cn(
          "mx-auto grid h-dvh max-w-[1640px] gap-3 p-3 transition-[grid-template-columns] duration-200 lg:gap-4 lg:p-4",
          isDesktopSidebarCollapsed && isDesktopChatCollapsed
            ? "grid-cols-[minmax(0,1fr)]"
            : isDesktopSidebarCollapsed
              ? "grid-cols-[minmax(0,1fr)_minmax(17rem,19rem)] lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_344px]"
              : isDesktopChatCollapsed
                ? "grid-cols-[minmax(13.5rem,15.5rem)_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)]"
                : "grid-cols-[minmax(13.5rem,15.5rem)_minmax(0,1fr)_minmax(17rem,19rem)] lg:grid-cols-[16rem_minmax(0,1fr)_20rem] xl:grid-cols-[288px_minmax(0,1fr)_344px]",
        )}
      >
        {!isDesktopSidebarCollapsed ? (
          <aside className="min-h-0 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/78 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            <LearnSidebar
              courseTitle={courseTitle}
              width={SIDEBAR_WIDTH}
              onCollapse={() => setDesktopSidebarCollapsed(true)}
            />
          </aside>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[30px] border border-black/[0.04] bg-white/94 shadow-[0_24px_76px_-58px_rgba(15,23,42,0.32)]">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-black/[0.04] bg-white/86 px-5 py-3 backdrop-blur-xl lg:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                {courseTitle}
              </h1>
              {currentChapter ? (
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                  {currentChapter.title}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CoursePublishControl courseId={sessionId} />
              {isDesktopSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setDesktopSidebarCollapsed(false)}
                  className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                  aria-label="展开目录"
                >
                  目录
                </button>
              ) : null}
              {isDesktopChatCollapsed ? (
                <button
                  type="button"
                  onClick={() => setDesktopChatCollapsed(false)}
                  className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                  aria-label="打开提问"
                >
                  提问
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className="relative rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                aria-label="打开评论"
              >
                评论
                {currentSectionAnnotationCount > 0 ? (
                  <span className="ml-1.5 text-[var(--color-text-tertiary)]">
                    {currentSectionAnnotationCount}
                  </span>
                ) : null}
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1">
            <SectionReader
              courseId={sessionId}
              sections={sections}
              currentGenerating={currentGenerating}
              generateSection={generateSection}
              sectionDocs={sectionDocs}
              publicAnnotations={publicAnnotations}
              scrollToSectionId={scrollToSectionId}
            />
          </div>
        </main>

        {!isDesktopChatCollapsed ? (
          <aside className="min-h-0 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/82 shadow-[0_22px_64px_-50px_rgba(15,23,42,0.3)] backdrop-blur-xl">
            <LearnChat
              courseId={sessionId}
              courseTitle={courseTitle}
              onCollapse={() => setDesktopChatCollapsed(true)}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

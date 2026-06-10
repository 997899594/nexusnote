// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { List, MessageSquare, MessageSquareText, MoreHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CoursePublishControl } from "@/components/course-reader/CoursePublishControl";
import { AppBackLink } from "@/components/shared/layout";
import { useChapterSections } from "@/hooks/useChapterSections";
import { useIsMobile } from "@/hooks/useIsMobile";
import { stripSectionNumber } from "@/lib/learning/content-formatting";
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
  const currentSectionIndex = useLearnStore((s) => s.currentSectionIndex);
  const isSidebarOpen = useLearnStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useLearnStore((s) => s.setSidebarOpen);
  const isChatOpen = useLearnStore((s) => s.isChatOpen);
  const setChatOpen = useLearnStore((s) => s.setChatOpen);
  const setChatSelectionContext = useLearnStore((s) => s.setChatSelectionContext);
  const isNotesOpen = useLearnStore((s) => s.isNotesOpen);
  const setNotesOpen = useLearnStore((s) => s.setNotesOpen);
  const currentSectionAnnotationCount = useLearnStore((s) => s.currentSectionAnnotationCount);
  const isDesktopSidebarCollapsed = useLearnStore((s) => s.isDesktopSidebarCollapsed);
  const setDesktopSidebarCollapsed = useLearnStore((s) => s.setDesktopSidebarCollapsed);
  const isDesktopChatCollapsed = useLearnStore((s) => s.isDesktopChatCollapsed);
  const setDesktopChatCollapsed = useLearnStore((s) => s.setDesktopChatCollapsed);

  const isMobile = useIsMobile();
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);

  // Initialize store on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialization effect, runs once on mount
  useEffect(() => {
    // Set chapter index BEFORE loading chapters to avoid triggering PATCH
    setCurrentChapterIndex(initialChapterIndex);
    setCourseId(sessionId);
    setChapters(chapters);
    setSidebarOpen(false);
    setChatOpen(false);
    setChatSelectionContext(null);
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
  const currentSection = currentChapter?.sections[currentSectionIndex] ?? null;
  const mobileHeaderTitle = stripSectionNumber(
    currentSection?.title ?? currentChapter?.title ?? courseTitle,
  );

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
    if (isSidebarOpen || isChatOpen || isNotesOpen || isMobileToolsOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobile, isMobileToolsOpen, isSidebarOpen, isChatOpen, isNotesOpen]);

  // ─── Mobile layout ───
  if (isMobile) {
    return (
      <div className="ui-page-shell flex min-h-dvh flex-col safe-bottom">
        {/* Mobile header */}
        <header className="safe-top sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 bg-white/90 px-4 pb-2 pt-3 backdrop-blur-xl">
          <AppBackLink target={PAGE_BACK_TARGETS.learn} />
          <div className="min-w-0 flex-1 text-center text-sm font-semibold text-[var(--color-text)]">
            <span className="line-clamp-1">{mobileHeaderTitle}</span>
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

        <nav className="safe-bottom fixed right-3 bottom-4 z-30 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileToolsOpen(true)}
            className={cn(
              "relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/92 text-[var(--color-text-secondary)] shadow-[0_14px_38px_-26px_rgba(15,23,42,0.42)] backdrop-blur-xl transition-colors",
              isMobileToolsOpen
                ? "bg-[var(--color-panel-strong)] text-white"
                : "hover:text-[var(--color-text)]",
            )}
            aria-label="打开工具"
            title="工具"
          >
            <MoreHorizontal className="h-5 w-5" />
            {currentSectionAnnotationCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-md bg-[var(--color-panel-strong)] px-1 text-[0.625rem] leading-4 text-white">
                {currentSectionAnnotationCount}
              </span>
            ) : null}
          </button>
        </nav>

        <AnimatePresence>
          {isMobileToolsOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <motion.button
                type="button"
                aria-label="关闭工具"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={() => setIsMobileToolsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="ui-message-card safe-bottom absolute inset-x-3 bottom-3 rounded-[28px] p-3"
              >
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
                  {[
                    {
                      label: "目录",
                      meta: "章节与进度",
                      icon: List,
                      onClick: () => setSidebarOpen(true),
                    },
                    {
                      label: "提问",
                      meta: "围绕当前小节",
                      icon: MessageSquare,
                      onClick: () => setChatOpen(true),
                    },
                    {
                      label: "评论",
                      meta:
                        currentSectionAnnotationCount > 0
                          ? `${currentSectionAnnotationCount} 条记录`
                          : "当前小节",
                      icon: MessageSquareText,
                      onClick: () => setNotesOpen(true),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setIsMobileToolsOpen(false);
                        item.onClick();
                      }}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[var(--color-panel-soft)]"
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
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>

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
                <LearnSidebar width={SIDEBAR_WIDTH} />
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
    <div className="min-h-dvh overflow-hidden bg-[#f4f5f5] text-[var(--color-text)]">
      <div
        className={cn(
          "grid h-dvh grid-cols-1 overflow-hidden transition-[grid-template-columns] duration-200",
          isDesktopSidebarCollapsed && isDesktopChatCollapsed
            ? "grid-cols-[minmax(0,1fr)]"
            : isDesktopSidebarCollapsed
              ? "lg:grid-cols-[minmax(0,1fr)_21.5rem]"
              : isDesktopChatCollapsed
                ? "lg:grid-cols-[17.5rem_minmax(0,1fr)]"
                : "lg:grid-cols-[17.5rem_minmax(0,1fr)_21.5rem]",
        )}
      >
        {!isDesktopSidebarCollapsed ? (
          <aside className="min-h-0 border-black/[0.06] bg-white/95 lg:flex lg:h-full lg:flex-col lg:border-r">
            <LearnSidebar
              width={SIDEBAR_WIDTH}
              onCollapse={() => setDesktopSidebarCollapsed(true)}
            />
          </aside>
        ) : null}

        <main className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          <header className="safe-top flex shrink-0 justify-end border-b border-black/[0.04] bg-white/92 px-4 py-3 backdrop-blur-xl lg:px-7">
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
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
          <aside className="min-h-0 border-black/[0.06] bg-[#fafafa] lg:flex lg:h-full lg:flex-col lg:border-l">
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

// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, List, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useChapterSections } from "@/hooks/useChapterSections";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { LearnPageProjection, LearnResumeState } from "@/lib/learning/projection";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

import { LearnChat } from "./components/LearnChat";
import { LearnSidebar } from "./components/LearnSidebar";
import { SectionReader } from "./components/SectionReader";

export interface LearnClientProps
  extends Pick<LearnPageProjection, "courseTitle" | "chapters" | "sectionDocs">,
    Pick<
      LearnResumeState,
      "initialChapterIndex" | "initialCompletedSections" | "scrollToSectionId"
    > {
  sessionId: string;
}

// Sidebar width constant
const SIDEBAR_WIDTH = 312;

// Animation variants
const sidebarVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    x: -16,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

export function LearnClient({
  sessionId,
  courseTitle,
  chapters,
  sectionDocs,
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

  const isMobile = useIsMobile();
  const router = useRouter();

  // Initialize store on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialization effect, runs once on mount
  useEffect(() => {
    // Set chapter index BEFORE loading chapters to avoid triggering PATCH
    setCurrentChapterIndex(initialChapterIndex);
    setCourseId(sessionId);
    setChapters(chapters);
    setSidebarOpen(false);
    setChatOpen(false);

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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setChatOpen, setSidebarOpen]);

  // Lock body scroll when overlay is open (mobile)
  useEffect(() => {
    if (!isMobile) return;
    if (isSidebarOpen || isChatOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isMobile, isSidebarOpen, isChatOpen]);

  // ─── Mobile layout ───
  if (isMobile) {
    return (
      <div className="ui-page-shell flex min-h-dvh flex-col safe-bottom">
        {/* Mobile header */}
        <header className="safe-top sticky top-0 z-30 shrink-0 border-b border-black/5 bg-white/95 px-4 pb-3 pt-3 backdrop-blur-xl shadow-[var(--shadow-soft-panel)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <button
                type="button"
                onClick={() => router.back()}
                className="ui-control-surface mt-0.5 shrink-0 rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 space-y-1">
                <h1 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--color-text)]">
                  {courseTitle}
                </h1>
                <p className="truncate text-[0.6875rem] text-[var(--color-text-tertiary)]">
                  {currentChapter ? `第 ${currentChapterIndex + 1} 章` : "课程"}
                </p>
              </div>
            </div>
            <div className="ui-control-surface flex shrink-0 items-center gap-1 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={cn(
                  "rounded-xl p-2 transition-colors",
                  isSidebarOpen
                    ? "ui-primary-button"
                    : "text-[var(--color-text-secondary)] hover:bg-white",
                )}
              >
                <List className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className={cn(
                  "rounded-xl p-2 transition-colors",
                  isChatOpen
                    ? "ui-primary-button"
                    : "text-[var(--color-text-secondary)] hover:bg-white",
                )}
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-hidden bg-white">
          <SectionReader
            courseId={sessionId}
            sections={sections}
            currentGenerating={currentGenerating}
            generateSection={generateSection}
            sectionDocs={sectionDocs}
            scrollToSectionId={scrollToSectionId}
          />
        </div>

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
                className="ui-page-shell fixed inset-y-0 left-0 z-50 w-[min(88vw,312px)] overflow-hidden rounded-r-[28px] shadow-xl"
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
    <div className="ui-page-shell flex min-h-dvh gap-3 p-3 md:gap-4 md:p-4 lg:gap-5 lg:p-5">
      <motion.div
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        style={{ width: SIDEBAR_WIDTH }}
        className="ui-page-shell flex-shrink-0 overflow-hidden rounded-[30px] border border-black/5 shadow-[var(--shadow-floating-panel)]"
      >
        <LearnSidebar courseTitle={courseTitle} width={SIDEBAR_WIDTH} />
      </motion.div>

      {/* Main content */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_-56px_rgba(15,23,42,0.35)]">
        {/* Section content (streaming generation + read-only) */}
        <div className="flex-1 overflow-hidden bg-white">
          <SectionReader
            courseId={sessionId}
            sections={sections}
            currentGenerating={currentGenerating}
            generateSection={generateSection}
            sectionDocs={sectionDocs}
            scrollToSectionId={scrollToSectionId}
          />
        </div>
      </div>

      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.button
              type="button"
              aria-label="关闭学习助手"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/[0.04]"
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              initial={{ x: 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="ui-page-shell fixed bottom-5 right-5 top-5 z-50 w-[min(26rem,calc(100vw-2.5rem))] overflow-hidden rounded-[32px] border border-black/5 shadow-[var(--shadow-floating-panel)]"
            >
              <LearnChat courseId={sessionId} courseTitle={courseTitle} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

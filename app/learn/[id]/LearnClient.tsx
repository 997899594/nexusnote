// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, List, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { Annotation } from "@/hooks/useAnnotations";
import { useChapterSections } from "@/hooks/useChapterSections";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GrowthFocusSummary, GrowthInsightSummary } from "@/lib/growth/projection-types";
import { cn } from "@/lib/utils";
import type { ChapterOutline } from "@/stores/learn";
import { useLearnStore } from "@/stores/learn";

import { LearnChat } from "./components/LearnChat";
import { LearnSidebar } from "./components/LearnSidebar";
import { SectionReader } from "./components/SectionReader";
import { ZenModeToggle } from "./components/ZenModeToggle";

// Props types matching page.tsx data
export interface SectionDoc {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeKey: string | null;
  annotations: Annotation[];
}

export interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: ChapterOutline[];
  sectionDocs: SectionDoc[];
  growthFocus: GrowthFocusSummary | null;
  insights: GrowthInsightSummary[];
  initialChapterIndex: number;
  initialCompletedSections: string[];
  scrollToSectionId: string | null;
}

// Sidebar width constant
const SIDEBAR_WIDTH = 336;

// Animation variants
const sidebarVariants = {
  hidden: { width: 0, opacity: 0, x: -SIDEBAR_WIDTH },
  visible: {
    width: SIDEBAR_WIDTH,
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    width: 0,
    opacity: 0,
    x: -SIDEBAR_WIDTH,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

const mainVariants = {
  full: { marginLeft: 0 },
  withSidebar: {
    marginLeft: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

export function LearnClient({
  sessionId,
  courseTitle,
  chapters,
  sectionDocs,
  growthFocus,
  insights,
  initialChapterIndex,
  initialCompletedSections,
  scrollToSectionId,
}: LearnClientProps) {
  const setCourseId = useLearnStore((s) => s.setCourseId);
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const toggleChapterExpanded = useLearnStore((s) => s.toggleChapterExpanded);
  const isZenMode = useLearnStore((s) => s.isZenMode);
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

    // Expand initial chapter in sidebar
    toggleChapterExpanded(initialChapterIndex);
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
  const { sections, generateSection } = useChapterSections({
    courseId: sessionId,
    chapterIndex: currentChapterIndex,
    sectionCount: currentChapter?.sections.length ?? 0,
    initialContent,
  });

  // Close overlays on ESC (mobile)
  useEffect(() => {
    if (!isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setChatOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, setChatOpen, setSidebarOpen]);

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
      <div className="ui-page-shell flex min-h-dvh flex-col bg-[#f3f4f6] safe-bottom">
        {/* Mobile header */}
        <header className="safe-top sticky top-0 z-30 shrink-0 border-b border-black/5 bg-white/95 px-4 pb-3 pt-3 backdrop-blur-xl shadow-[0_18px_42px_-34px_rgba(15,23,42,0.14)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <button
                type="button"
                onClick={() => router.back()}
                className="mt-0.5 shrink-0 rounded-xl border border-black/8 bg-[#f6f8fb] p-2 text-[var(--color-text-secondary)] shadow-[0_14px_28px_-22px_rgba(15,23,42,0.16)] transition-colors hover:bg-white hover:text-[var(--color-text)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 space-y-1">
                <h1 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--color-text)]">
                  {courseTitle}
                </h1>
                <p className="truncate text-[0.6875rem] text-[var(--color-text-tertiary)]">
                  {currentChapter ? `当前阅读 · 第 ${currentChapterIndex + 1} 章` : "课程工作台"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-black/8 bg-[#f6f8fb] p-1 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.14)]">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={cn(
                  "rounded-xl p-2 transition-colors",
                  isSidebarOpen
                    ? "bg-[#111827] text-white shadow-[0_12px_22px_-16px_rgba(15,23,42,0.35)]"
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
                    ? "bg-[#111827] text-white shadow-[0_12px_22px_-16px_rgba(15,23,42,0.35)]"
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
            generateSection={generateSection}
            sectionDocs={sectionDocs}
            scrollToSectionId={scrollToSectionId}
          />
        </div>

        {/* Zen toggle */}
        <ZenModeToggle />

        {/* Sidebar overlay - slide from left */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -SIDEBAR_WIDTH }}
                animate={{ x: 0 }}
                exit={{ x: -SIDEBAR_WIDTH }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-[min(88vw,336px)] overflow-hidden rounded-r-[28px] bg-[#f6f7f9] shadow-xl"
              >
                <LearnSidebar
                  courseTitle={courseTitle}
                  width={SIDEBAR_WIDTH}
                  growthFocus={growthFocus}
                  insights={insights}
                />
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
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={() => setChatOpen(false)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 right-0 z-50 w-full overflow-hidden bg-[#f6f7f9] shadow-xl"
              >
                <LearnChat
                  courseId={sessionId}
                  courseTitle={courseTitle}
                  growthFocus={growthFocus}
                  insights={insights}
                  variant="overlay"
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Desktop layout (unchanged) ───
  return (
    <div className="ui-page-shell flex min-h-dvh gap-3 p-3 md:gap-4 md:p-4 lg:gap-5 lg:p-5">
      {/* Sidebar - hidden in zen mode */}
      <AnimatePresence mode="wait">
        {!isZenMode && (
          <motion.div
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-shrink-0 overflow-hidden rounded-[30px] border border-black/5 bg-[#f6f7f9] shadow-[0_22px_54px_-40px_rgba(15,23,42,0.22)]"
          >
            <LearnSidebar
              courseTitle={courseTitle}
              width={SIDEBAR_WIDTH}
              growthFocus={growthFocus}
              insights={insights}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.div
        variants={mainVariants}
        initial="full"
        animate={isZenMode ? "full" : "withSidebar"}
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_24px_56px_-42px_rgba(15,23,42,0.18)]"
      >
        {/* Header - hidden in zen mode */}
        <AnimatePresence>
          {!isZenMode && currentChapter && (
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-8 py-5 backdrop-blur-xl"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Learning Workspace
                </div>
                <h1 className="max-w-3xl truncate text-lg font-semibold text-[var(--color-text)]">
                  {courseTitle}
                </h1>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-[0.72rem] text-[var(--color-text-secondary)]">
                  当前阅读 · 第 {currentChapterIndex + 1} 章
                </span>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Section content (streaming generation + read-only) */}
        <div className="flex-1 overflow-hidden bg-white">
          <SectionReader
            courseId={sessionId}
            sections={sections}
            generateSection={generateSection}
            sectionDocs={sectionDocs}
            scrollToSectionId={scrollToSectionId}
          />
        </div>

        {/* Zen toggle */}
        <ZenModeToggle />
      </motion.div>

      {/* AI Chat panel - hidden in zen mode */}
      <AnimatePresence>
        {!isZenMode && (
          <LearnChat
            courseId={sessionId}
            courseTitle={courseTitle}
            growthFocus={growthFocus}
            insights={insights}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

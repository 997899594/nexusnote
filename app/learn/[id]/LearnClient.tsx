// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, List, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import type { Annotation } from "@/hooks/useAnnotations";
import { useChapterSections } from "@/hooks/useChapterSections";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  outlineNodeId: string | null;
  annotations: Annotation[];
}

export interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: ChapterOutline[];
  sectionDocs: SectionDoc[];
  initialChapterIndex: number;
  initialCompletedSections: string[];
  scrollToSectionId: string | null;
}

// Sidebar width constant
const SIDEBAR_WIDTH = 320;

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
      if (doc.content && doc.outlineNodeId) {
        map.set(doc.outlineNodeId, { content: doc.content, documentId: doc.id });
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
  const closeOverlays = useCallback(() => {
    setSidebarOpen(false);
    setChatOpen(false);
  }, [setSidebarOpen, setChatOpen]);

  useEffect(() => {
    if (!isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlays();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, closeOverlays]);

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
      <div className="flex h-screen flex-col bg-[#f6f7f9]">
        {/* Mobile header */}
        <header className="shrink-0 bg-white px-4 py-3 shadow-[0_16px_38px_-34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[#f3f5f8]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-[var(--color-text)]">
                  {currentChapter?.title ?? courseTitle}
                </h1>
                {currentChapter && (
                  <p className="truncate text-[0.6875rem] text-[var(--color-text-tertiary)]">
                    第 {currentChapterIndex + 1} 章
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  isSidebarOpen
                    ? "bg-[#eef1f5] text-[#111827]"
                    : "text-[var(--color-text-secondary)] hover:bg-[#f3f5f8]",
                )}
              >
                <List className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  isChatOpen
                    ? "bg-[#eef1f5] text-[#111827]"
                    : "text-[var(--color-text-secondary)] hover:bg-[#f3f5f8]",
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
                className="fixed inset-y-0 left-0 z-50 w-[320px] bg-[#f6f7f9] shadow-xl"
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
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={() => setChatOpen(false)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 right-0 z-50 w-full bg-[#f6f7f9] shadow-xl"
              >
                <LearnChat courseId={sessionId} courseTitle={courseTitle} variant="overlay" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Desktop layout (unchanged) ───
  return (
    <div className="flex h-screen bg-[#f6f7f9]">
      {/* Sidebar - hidden in zen mode */}
      <AnimatePresence mode="wait">
        {!isZenMode && (
          <motion.div
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-shrink-0 overflow-hidden"
          >
            <LearnSidebar courseTitle={courseTitle} width={SIDEBAR_WIDTH} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.div
        variants={mainVariants}
        initial="full"
        animate={isZenMode ? "full" : "withSidebar"}
        className="relative flex min-w-0 flex-1 flex-col bg-white"
      >
        {/* Header - hidden in zen mode */}
        <AnimatePresence>
          {!isZenMode && currentChapter && (
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between bg-white px-6 py-3 shadow-[0_16px_38px_-34px_rgba(15,23,42,0.12)]"
            >
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-[#eef1f5] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#111827]">
                  第 {currentChapterIndex + 1} 章
                </span>
                <h1 className="text-sm font-semibold text-[var(--color-text)] truncate max-w-md">
                  {currentChapter.title}
                </h1>
              </div>
              <div className="hidden md:flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                <span className="truncate max-w-[200px]">{courseTitle}</span>
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
        {!isZenMode && <LearnChat courseId={sessionId} courseTitle={courseTitle} />}
      </AnimatePresence>
    </div>
  );
}

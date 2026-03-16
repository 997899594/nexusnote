// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import type { Annotation } from "@/hooks/useAnnotations";
import { useChapterSections } from "@/hooks/useChapterSections";
import type { ChapterOutline, SectionOutline } from "@/stores/learn";
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
  metadata: { annotations?: Annotation[] } | null;
}

export interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: ChapterOutline[];
  sectionDocs: SectionDoc[];
  initialChapterIndex: number;
  initialCompletedSections: string[];
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
}: LearnClientProps) {
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const markSectionComplete = useLearnStore((s) => s.markSectionComplete);
  const toggleChapterExpanded = useLearnStore((s) => s.toggleChapterExpanded);
  const isZenMode = useLearnStore((s) => s.isZenMode);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);

  // Initialize store on mount
  useEffect(() => {
    setChapters(chapters);
    setCurrentChapterIndex(initialChapterIndex);

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
  const { sections, currentGenerating, generateSection } = useChapterSections({
    courseId: sessionId,
    chapterIndex: currentChapterIndex,
    sectionCount: currentChapter?.sections.length ?? 0,
    initialContent,
  });

  // Mark sections complete as they finish generating
  useEffect(() => {
    for (const [secIdx, state] of sections) {
      if (state.status === "complete") {
        const nodeId = `section-${currentChapterIndex + 1}-${secIdx + 1}`;
        markSectionComplete(nodeId);
      }
    }
  }, [sections, currentChapterIndex, markSectionComplete]);

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
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
        className="flex-1 flex flex-col min-w-0 relative bg-[var(--color-surface)]"
      >
        {/* Header - hidden in zen mode */}
        <AnimatePresence>
          {!isZenMode && currentChapter && (
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
            >
              <div className="flex items-center gap-3">
                <span className="text-[0.6875rem] font-semibold text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-2.5 py-1 rounded-md">
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
        <div className="flex-1 overflow-hidden bg-[var(--color-surface)]">
          <SectionReader
            courseId={sessionId}
            sections={sections}
            generateSection={generateSection}
            sectionDocs={sectionDocs}
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

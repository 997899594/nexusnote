// app/learn/[id]/LearnClient.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useLearnStore } from "@/stores/learn";

import { ChapterContent } from "./components/ChapterContent";
import { LearnChat } from "./components/LearnChat";
import { LearnSidebar } from "./components/LearnSidebar";
import { ZenModeToggle } from "./components/ZenModeToggle";

// Props types matching page.tsx data
export interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

export interface ChapterDoc {
  id: string;
  title: string | null;
  content: Buffer | null;
  outlineNodeId: string | null;
}

export interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: Chapter[];
  chapterDocs: ChapterDoc[];
  initialChapterIndex: number;
  progress: { completedChapters?: string[] } | null;
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
  chapterDocs,
  initialChapterIndex,
  progress,
}: LearnClientProps) {
  // Get store actions and state
  const setChapters = useLearnStore((s) => s.setChapters);
  const setCurrentChapterIndex = useLearnStore((s) => s.setCurrentChapterIndex);
  const markChapterComplete = useLearnStore((s) => s.markChapterComplete);
  const isZenMode = useLearnStore((s) => s.isZenMode);
  const currentChapterIndex = useLearnStore((s) => s.currentChapterIndex);

  // Initialize store on mount
  useEffect(() => {
    setChapters(chapters);
    setCurrentChapterIndex(initialChapterIndex);

    // Initialize completed chapters from progress
    if (progress?.completedChapters) {
      for (const chapterId of progress.completedChapters) {
        markChapterComplete(chapterId);
      }
    }
  }, [
    chapters,
    initialChapterIndex,
    progress,
    setChapters,
    setCurrentChapterIndex,
    markChapterComplete,
  ]);

  // Current chapter info
  const currentChapter = chapters[currentChapterIndex];

  return (
    <div className="flex h-screen bg-[var(--color-bg-secondary)]">
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
        className="flex-1 flex flex-col min-w-0 relative bg-white"
      >
        {/* Header - hidden in zen mode */}
        <AnimatePresence>
          {!isZenMode && (
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-white"
            >
              <div className="flex items-center gap-3">
                {/* Chapter indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-1 rounded-full">
                    {currentChapterIndex + 1} / {chapters.length}
                  </span>
                </div>
                <h1 className="font-semibold text-zinc-900 truncate max-w-md">
                  {currentChapter?.title || courseTitle}
                </h1>
              </div>

              {/* Course title breadcrumb */}
              <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
                <span className="truncate max-w-[200px]">{courseTitle}</span>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* Chapter content (streaming generation + editor) */}
        <div className="flex-1 overflow-auto bg-[var(--color-bg)]">
          <ChapterContent courseId={sessionId} chapterDocs={chapterDocs} />
        </div>

        {/* Zen toggle */}
        <ZenModeToggle />
      </motion.div>

      {/* AI Chat panel - hidden in zen mode */}
      <AnimatePresence>
        {!isZenMode && (
          <LearnChat courseId={sessionId} courseTitle={courseTitle} />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * LearnClient - Main client component for /learn/[sessionId]
 *
 * Manages layout with left sidebar (chapter navigation) and right editor area.
 * Supports zen mode for immersive learning (hides sidebar and header).
 */

"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { useLearnStore } from "@/stores/learn";

import { LearnEditor } from "./components/LearnEditor";
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

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar - hidden in zen mode */}
      <AnimatePresence>{!isZenMode && <LearnSidebar courseTitle={courseTitle} />}</AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-white">
        {/* Header - hidden in zen mode */}
        {!isZenMode && (
          <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b border-zinc-100">
            <h1 className="font-semibold text-zinc-900 truncate">{courseTitle}</h1>
          </header>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          <LearnEditor chapterDocs={chapterDocs} />
        </div>

        {/* Zen toggle */}
        <ZenModeToggle />
      </div>
    </div>
  );
}

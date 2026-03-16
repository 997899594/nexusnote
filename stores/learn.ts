/**
 * Learn Store - 课程学习状态管理
 *
 * 管理学习页面的章节/小节导航、禅模式和学习进度
 */

import { create } from "zustand";

export interface SectionOutline {
  title: string;
  description: string;
  nodeId: string; // e.g., "section-1-1"
}

export interface ChapterOutline {
  title: string;
  description: string;
  sections: SectionOutline[];
}

interface LearnState {
  // Current chapter index
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;

  // Current section index (within chapter, driven by Intersection Observer)
  currentSectionIndex: number;
  setCurrentSectionIndex: (index: number) => void;

  // Chapter outlines (with sections)
  chapters: ChapterOutline[];
  setChapters: (chapters: ChapterOutline[]) => void;

  // Expanded chapters in sidebar
  expandedChapters: Set<number>;
  toggleChapterExpanded: (index: number) => void;

  // Completed sections (Set of nodeId strings like "section-1-1")
  completedSections: Set<string>;
  markSectionComplete: (nodeId: string) => void;

  // Zen mode (immersive learning)
  isZenMode: boolean;
  toggleZenMode: () => void;
  setZenMode: (isZen: boolean) => void;

  // Chat panel
  isChatOpen: boolean;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentChapterIndex: 0,
  currentSectionIndex: 0,
  chapters: [] as ChapterOutline[],
  expandedChapters: new Set<number>(),
  completedSections: new Set<string>(),
  isZenMode: false,
  isChatOpen: true,
};

export const useLearnStore = create<LearnState>((set) => ({
  ...initialState,

  setCurrentChapterIndex: (index) => set({ currentChapterIndex: index, currentSectionIndex: 0 }),

  setCurrentSectionIndex: (index) => set({ currentSectionIndex: index }),

  setChapters: (chapters) => set({ chapters }),

  toggleChapterExpanded: (index) =>
    set((state) => {
      const expanded = new Set(state.expandedChapters);
      if (expanded.has(index)) {
        expanded.delete(index);
      } else {
        expanded.add(index);
      }
      return { expandedChapters: expanded };
    }),

  markSectionComplete: (nodeId) =>
    set((state) => {
      const completed = new Set(state.completedSections);
      completed.add(nodeId);
      return { completedSections: completed };
    }),

  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

  setZenMode: (isZenMode) => set({ isZenMode }),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  setChatOpen: (isChatOpen) => set({ isChatOpen }),

  reset: () => set(initialState),
}));

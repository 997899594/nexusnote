/**
 * Learn Store - 课程学习状态管理
 *
 * 管理学习页面的章节导航、禅模式和学习进度
 */

import { create } from "zustand";

export interface Chapter {
  id: string;
  title: string;
  nodeId: string;
}

interface LearnState {
  // Current chapter index
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;

  // Chapter list
  chapters: Chapter[];
  setChapters: (chapters: Chapter[]) => void;

  // Zen mode (immersive learning)
  isZenMode: boolean;
  toggleZenMode: () => void;
  setZenMode: (isZen: boolean) => void;

  // Completed chapters
  completedChapters: Set<string>;
  markChapterComplete: (chapterId: string) => void;
  isChapterComplete: (chapterId: string) => boolean;

  // Reset
  reset: () => void;
}

const initialState = {
  currentChapterIndex: 0,
  chapters: [],
  isZenMode: false,
  completedChapters: new Set<string>(),
};

export const useLearnStore = create<LearnState>((set, get) => ({
  ...initialState,

  setCurrentChapterIndex: (index) => set({ currentChapterIndex: index }),

  setChapters: (chapters) => set({ chapters }),

  toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),

  setZenMode: (isZenMode) => set({ isZenMode }),

  markChapterComplete: (chapterId) =>
    set((state) => {
      const completedChapters = new Set(state.completedChapters);
      completedChapters.add(chapterId);
      return { completedChapters };
    }),

  isChapterComplete: (chapterId) => get().completedChapters.has(chapterId),

  reset: () => set(initialState),
}));

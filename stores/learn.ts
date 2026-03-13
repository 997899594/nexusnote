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

  // Chat panel
  isChatOpen: boolean;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;

  // Generation tracking (which chapters have been generated this session)
  generatedChapters: Set<number>;
  markChapterGenerated: (index: number) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentChapterIndex: 0,
  chapters: [],
  isZenMode: false,
  completedChapters: new Set<string>(),
  isChatOpen: true,
  generatedChapters: new Set<number>(),
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

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  setChatOpen: (isChatOpen) => set({ isChatOpen }),

  markChapterGenerated: (index) =>
    set((state) => {
      const generatedChapters = new Set(state.generatedChapters);
      generatedChapters.add(index);
      return { generatedChapters };
    }),

  reset: () => set(initialState),
}));

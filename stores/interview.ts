/**
 * Interview Store - Interview state management
 *
 * 2026 简化版：
 * - profile: 3 个指标 (goal, background, outcome)
 * - outline: 课程大纲
 */

import { create } from "zustand";

export type LearningLevel = "none" | "beginner" | "intermediate" | "advanced";

export interface InterviewProfileState {
  goal: string | null;
  background: LearningLevel | null;
  outcome: string | null;
}

export interface Chapter {
  title: string;
  description?: string;
  topics?: string[];
}

export interface OutlineData {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  chapters: Chapter[];
}

interface InterviewStore {
  // 访谈画像
  profile: InterviewProfileState;
  // 课程大纲
  outline: OutlineData | null;
  // 课程 ID
  courseId: string | null;
  // 加载状态
  isOutlineLoading: boolean;
  // 访谈是否完成
  interviewCompleted: boolean;

  // Setters
  setProfile: (profile: Partial<InterviewProfileState>) => void;
  setOutline: (outline: OutlineData | null) => void;
  setCourseId: (id: string | null) => void;
  setIsOutlineLoading: (loading: boolean) => void;
  setInterviewCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialState = {
  profile: {
    goal: null,
    background: null as LearningLevel | null,
    outcome: null,
  },
  outline: null,
  courseId: null,
  isOutlineLoading: false,
  interviewCompleted: false,
};

export const useInterviewStore = create<InterviewStore>((set) => ({
  ...initialState,

  setProfile: (profile: Partial<InterviewProfileState>) => {
    set((state) => ({
      profile: { ...state.profile, ...profile },
    }));
  },

  setOutline: (outline: OutlineData | null) => {
    set({ outline });
  },

  setCourseId: (id: string | null) => {
    set({ courseId: id });
  },

  setIsOutlineLoading: (loading: boolean) => {
    set({ isOutlineLoading: loading });
  },

  setInterviewCompleted: (completed: boolean) => {
    set({ interviewCompleted: completed });
  },

  reset: () => {
    set(initialState);
  },
}));

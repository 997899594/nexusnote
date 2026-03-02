/**
 * Interview Store - Interview state management
 */

import { create } from "zustand";

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
  outline: OutlineData | null;
  courseId: string | null;
  isOutlineLoading: boolean;
  interviewCompleted: boolean;
  estimatedTurns: number | null; // 预计访谈轮数

  setOutline: (outline: OutlineData | null) => void;
  setCourseId: (id: string | null) => void;
  setIsOutlineLoading: (loading: boolean) => void;
  setInterviewCompleted: (completed: boolean) => void;
  setEstimatedTurns: (turns: number | null) => void;
  reset: () => void;
}

const initialState = {
  outline: null,
  courseId: null,
  isOutlineLoading: false,
  interviewCompleted: false,
  estimatedTurns: null,
};

export const useInterviewStore = create<InterviewStore>((set) => ({
  ...initialState,

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

  setEstimatedTurns: (turns: number | null) => {
    set({ estimatedTurns: turns });
  },

  reset: () => {
    set(initialState);
  },
}));

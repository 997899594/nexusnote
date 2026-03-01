/**
 * Interview Store - Interview state management
 *
 * Responsibilities:
 * - Manage current outline data
 * - Manage courseProfileId
 * - Manage outline loading state
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
  courseProfileId: string | null;
  isOutlineLoading: boolean;

  setOutline: (outline: OutlineData | null) => void;
  setCourseProfileId: (id: string | null) => void;
  setIsOutlineLoading: (loading: boolean) => void;
}

export const useInterviewStore = create<InterviewStore>((set) => ({
  outline: null,
  courseProfileId: null,
  isOutlineLoading: false,

  setOutline: (outline: OutlineData | null) => {
    set({ outline });
  },

  setCourseProfileId: (id: string | null) => {
    set({ courseProfileId: id });
  },

  setIsOutlineLoading: (loading: boolean) => {
    set({ isOutlineLoading: loading });
  },
}));

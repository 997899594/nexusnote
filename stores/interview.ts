// stores/interview.ts
import { create } from "zustand";

export interface Section {
  title: string; // e.g., "变量与常量"
}

export interface Chapter {
  title: string;
  sections: Section[]; // replaces topics: string[]
  practiceType?: "exercise" | "project" | "quiz" | "none";
}

export interface OutlineData {
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  chapters: Chapter[];
}

interface InterviewStore {
  outline: OutlineData | null;
  courseId: string | null;
  isOutlineLoading: boolean;
  interviewCompleted: boolean;

  setOutline: (outline: OutlineData | null) => void;
  setCourseId: (id: string | null) => void;
  setIsOutlineLoading: (loading: boolean) => void;
  setInterviewCompleted: (completed: boolean) => void;
  reset: () => void;
}

const initialState = {
  outline: null,
  courseId: null,
  isOutlineLoading: false,
  interviewCompleted: false,
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

  reset: () => {
    set(initialState);
  },
}));

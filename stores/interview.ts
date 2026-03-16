// stores/interview.ts
import { create } from "zustand";

export interface Section {
  title: string; // e.g., "变量与常量"
  description: string; // e.g., "理解 Python 中变量的声明、赋值和命名规范"
}

export interface Chapter {
  title: string;
  description: string;
  sections: Section[]; // replaces topics: string[]
  estimatedMinutes?: number;
  practiceType?: "exercise" | "project" | "quiz" | "none";
}

export interface OutlineData {
  title: string;
  description: string;
  targetAudience: string;
  prerequisites?: string[];
  estimatedHours: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  chapters: Chapter[];
  learningOutcome: string;
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

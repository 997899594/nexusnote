import type { InterviewOutline } from "./schemas";

export interface Section {
  title: string;
  description?: string;
}

export interface Chapter {
  title: string;
  description?: string;
  sections: Section[];
  practiceType?: "exercise" | "project" | "quiz" | "none";
  skillIds?: string[];
}

export interface OutlineDisplay {
  title?: string;
  description?: string;
  targetAudience?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  learningOutcome?: string;
  courseSkillIds?: string[];
  chapters: Chapter[];
}

export interface InterviewOptionAction {
  label: string;
  action?: string;
  intent?: "reply" | "revise" | "start_course";
}

export interface InterviewOutlineState {
  display: OutlineDisplay | null;
  stable: InterviewOutline | null;
  actions: InterviewOptionAction[];
  isLoading: boolean;
  isReady: boolean;
}

export interface InterviewCourseState {
  id: string | null;
  setId: (courseId: string | null) => void;
}

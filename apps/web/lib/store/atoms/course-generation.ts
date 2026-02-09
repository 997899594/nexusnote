/**
 * Course Generation State
 *
 * 课程生成相关的全局状态
 * 从 useCourseGeneration hook 迁移而来
 * 支持自动保存到 localStorage
 */

import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";

// ============================================
// Types
// ============================================

export type GenerationPhase =
  | "idle"
  | "interview"
  | "synthesis"
  | "outline_review"
  | "seeding"
  | "growing"
  | "ready"
  | "manifesting";

export interface CourseGenerationState {
  // 访谈阶段数据
  goal: string;
  background: string;
  targetOutcome: string;
  cognitiveStyle: string;

  // 大纲数据
  outlineData: {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    modules: Array<{
      title: string;
      chapters: Array<{
        title: string;
        contentSnippet?: string;
      }>;
    }>;
  } | null;

  // 生成进度
  currentPhase: GenerationPhase;
  progress: {
    totalChapters: number;
    completedChapters: number;
    currentChapterTitle: string | null;
  };

  // 元数据
  courseId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Initial State
// ============================================

const initialState: CourseGenerationState = {
  goal: "",
  background: "",
  targetOutcome: "",
  cognitiveStyle: "",
  outlineData: null,
  currentPhase: "idle",
  progress: {
    totalChapters: 0,
    completedChapters: 0,
    currentChapterTitle: null,
  },
  courseId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================
// Atoms
// ============================================

/**
 * 课程生成状态主 atom（带 localStorage 持久化）
 */
export const courseGenerationStateAtom = atomWithStorage<CourseGenerationState>(
  "nexusnote-course-generation",
  initialState,
  undefined, // 使用默认 localStorage
);

/**
 * 当前生成阶段
 */
export const currentPhaseAtom = atom((get) => {
  return get(courseGenerationStateAtom).currentPhase;
});

/**
 * 是否正在生成
 */
export const isGeneratingAtom = atom((get) => {
  const phase = get(courseGenerationStateAtom).currentPhase;
  return (
    phase === "synthesis" ||
    phase === "seeding" ||
    phase === "growing" ||
    phase === "manifesting"
  );
});

/**
 * 生成进度百分比
 */
export const generationProgressAtom = atom((get) => {
  const { progress } = get(courseGenerationStateAtom);
  if (progress.totalChapters === 0) return 0;
  return Math.round((progress.completedChapters / progress.totalChapters) * 100);
});

// ============================================
// Action Atoms
// ============================================

/**
 * 更新访谈数据
 */
export const updateInterviewDataAtom = atom(
  null,
  (_get, set, data: Partial<Pick<CourseGenerationState, "goal" | "background" | "targetOutcome" | "cognitiveStyle">>) => {
    set(courseGenerationStateAtom, (prev) => ({
      ...prev,
      ...data,
      updatedAt: new Date().toISOString(),
    }));
  }
);

/**
 * 设置大纲数据
 */
export const setOutlineDataAtom = atom(
  null,
  (_get, set, outlineData: CourseGenerationState["outlineData"]) => {
    set(courseGenerationStateAtom, (prev) => ({
      ...prev,
      outlineData,
      updatedAt: new Date().toISOString(),
    }));
  }
);

/**
 * 更新生成阶段
 */
export const setCurrentPhaseAtom = atom(
  null,
  (_get, set, phase: GenerationPhase) => {
    set(courseGenerationStateAtom, (prev) => ({
      ...prev,
      currentPhase: phase,
      updatedAt: new Date().toISOString(),
    }));
  }
);

/**
 * 更新生成进度
 */
export const updateProgressAtom = atom(
  null,
  (_get, set, progress: Partial<CourseGenerationState["progress"]>) => {
    set(courseGenerationStateAtom, (prev) => ({
      ...prev,
      progress: { ...prev.progress, ...progress },
      updatedAt: new Date().toISOString(),
    }));
  }
);

/**
 * 重置课程生成状态
 */
export const resetCourseGenerationAtom = atom(
  null,
  (_get, _set) => {
    return initialState;
  }
);

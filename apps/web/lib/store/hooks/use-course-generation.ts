/**
 * Course Generation Hooks
 *
 * 基于 Jotai 的课程生成状态管理
 * 替代 useCourseGeneration hook
 *
 * 注意：由于原 hook 复杂度很高，这里提供 atom 层的状态管理
 * 原有 useCourseGeneration hook 可以逐步迁移
 */

"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { CourseGenerationState, GenerationPhase } from "../atoms/course-generation";
import {
  courseGenerationStateAtom,
  currentPhaseAtom,
  generationProgressAtom,
  isGeneratingAtom,
  resetCourseGenerationAtom,
  setCurrentPhaseAtom,
  setOutlineDataAtom,
  updateInterviewDataAtom,
  updateProgressAtom,
} from "../atoms/course-generation";

// ============================================
// Main Hook
// ============================================

/**
 * 课程生成主 Hook
 *
 * 替代原有的 useCourseGeneration hook
 */
export function useCourseGenerationState() {
  const [state, setState] = useAtom(courseGenerationStateAtom);
  const currentPhase = useAtomValue(currentPhaseAtom);
  const isGenerating = useAtomValue(isGeneratingAtom);
  const progress = useAtomValue(generationProgressAtom);

  /**
   * 更新访谈数据
   */
  const updateInterviewData = useCallback(
    (
      data: Partial<{
        goal: string;
        background: string;
        targetOutcome: string;
        cognitiveStyle: string;
      }>,
    ) => {
      setState((prev) => ({
        ...prev,
        ...data,
        updatedAt: new Date().toISOString(),
      }));
    },
    [setState],
  );

  /**
   * 设置大纲数据
   */
  const setOutlineData = useCallback(
    (outlineData: CourseGenerationState["outlineData"]) => {
      setState((prev) => ({
        ...prev,
        outlineData,
        updatedAt: new Date().toISOString(),
      }));
    },
    [setState],
  );

  /**
   * 设置当前阶段
   */
  const setPhase = useCallback(
    (phase: GenerationPhase) => {
      setState((prev) => ({
        ...prev,
        currentPhase: phase,
        updatedAt: new Date().toISOString(),
      }));
    },
    [setState],
  );

  /**
   * 更新进度
   */
  const updateProgress = useCallback(
    (progress: Partial<CourseGenerationState["progress"]>) => {
      setState((prev) => ({
        ...prev,
        progress: { ...prev.progress, ...progress },
        updatedAt: new Date().toISOString(),
      }));
    },
    [setState],
  );

  /**
   * 设置课程 ID
   */
  const setCourseId = useCallback(
    (courseId: string) => {
      setState((prev) => ({
        ...prev,
        courseId,
        updatedAt: new Date().toISOString(),
      }));
    },
    [setState],
  );

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
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
    });
  }, [setState]);

  return {
    // State
    state,
    currentPhase,
    isGenerating,
    progress,

    // 访谈数据（便捷访问）
    goal: state.goal,
    background: state.background,
    targetOutcome: state.targetOutcome,
    cognitiveStyle: state.cognitiveStyle,

    // 大纲数据
    outlineData: state.outlineData,
    courseId: state.courseId,

    // Actions
    updateInterviewData,
    setOutlineData,
    setPhase,
    updateProgress,
    setCourseId,
    reset,
  };
}

// ============================================
// Individual Hooks (如果只需要部分状态)
// ============================================

/**
 * 仅获取访谈阶段状态
 */
export function useInterviewPhase() {
  const state = useAtomValue(courseGenerationStateAtom);
  const updateData = useSetAtom(updateInterviewDataAtom);

  return {
    goal: state.goal,
    background: state.background,
    targetOutcome: state.targetOutcome,
    cognitiveStyle: state.cognitiveStyle,
    updateData,
  };
}

/**
 * 仅获取大纲数据
 */
export function useCourseOutline() {
  const state = useAtomValue(courseGenerationStateAtom);
  const setOutline = useSetAtom(setOutlineDataAtom);

  return {
    outlineData: state.outlineData,
    setOutline,
  };
}

/**
 * 仅获取生成进度
 */
export function useGenerationProgress() {
  const state = useAtomValue(courseGenerationStateAtom);
  const percentage = useAtomValue(generationProgressAtom);
  const isGenerating = useAtomValue(isGeneratingAtom);
  const updateProgress = useSetAtom(updateProgressAtom);

  return {
    progress: state.progress,
    isGenerating,
    percentage,
    updateProgress,
  };
}

/**
 * 仅获取阶段管理
 */
export function useGenerationPhase() {
  const phase = useAtomValue(currentPhaseAtom);
  const setPhase = useSetAtom(setCurrentPhaseAtom);
  const reset = useSetAtom(resetCourseGenerationAtom);

  return {
    phase,
    setPhase,
    reset,
    isGenerating:
      phase === "synthesis" ||
      phase === "seeding" ||
      phase === "growing" ||
      phase === "manifesting",
  };
}

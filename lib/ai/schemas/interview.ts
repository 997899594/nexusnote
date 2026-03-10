// lib/ai/schemas/interview.ts

import { z } from "zod";

/**
 * 访谈阶段 - 简化版
 */
export const InterviewPhaseSchema = z.enum([
  "collecting_goal",
  "collecting_background",
  "collecting_outcome",
  "ready",
  "completed",
]);

export type InterviewPhase = z.infer<typeof InterviewPhaseSchema>;

/**
 * 访谈状态 - 3 个指标
 * 与数据库 InterviewProfile 保持一致
 */
export const InterviewStateSchema = z.object({
  goal: z.string().nullable(),
  background: z.enum(["none", "beginner", "intermediate", "advanced"]).nullable(),
  outcome: z.string().nullable(),
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;

/**
 * 计算当前阶段
 * @param state - 访谈状态（goal, background, outcome）
 * @param hasOutline - 是否已生成大纲
 */
export function computePhase(
  state: InterviewState | null | undefined,
  hasOutline?: boolean,
): InterviewPhase {
  if (!state) return "collecting_goal";
  if (!state.goal) return "collecting_goal";
  if (!state.background) return "collecting_background";
  if (!state.outcome) return "collecting_outcome";

  // 三个指标收集完成后，检查是否已生成大纲
  if (hasOutline) return "completed";
  return "ready";
}

/**
 * 判断是否收集完成（三个指标都已填写）
 */
export function isProfileComplete(state: InterviewState | null | undefined): boolean {
  if (!state) return false;
  return !!state.goal && !!state.background && !!state.outcome;
}

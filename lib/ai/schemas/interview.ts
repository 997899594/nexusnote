// lib/ai/schemas/interview.ts

import { z } from "zod";

/**
 * 访谈阶段
 */
export const InterviewPhaseSchema = z.enum([
  "collecting_goal",
  "collecting_background",
  "collecting_time",
  "collecting_outcome",
  "ready",
  "completed",
]);

export type InterviewPhase = z.infer<typeof InterviewPhaseSchema>;

/**
 * 访谈状态 - 前端传递给 Agent
 */
export const InterviewStateSchema = z.object({
  goal: z.string().optional(),
  background: z.enum(["none", "beginner", "intermediate", "advanced"]).optional(),
  timeCommitment: z.enum(["casual", "moderate", "intensive"]).optional(),
  outcome: z.string().optional(),
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;

/**
 * 计算当前阶段
 */
export function computePhase(state: InterviewState): InterviewPhase {
  if (!state.goal) return "collecting_goal";
  if (!state.background) return "collecting_background";
  if (!state.timeCommitment) return "collecting_time";
  if (!state.outcome) return "collecting_outcome";
  return "ready";
}

/**
 * INTERVIEW Agent - 简化版状态机
 *
 * 从数据库读取 interviewProfile，判断收集阶段
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { courseSessions, db, eq } from "@/db";
import type { InterviewProfile } from "@/db/schema";
import { aiProvider } from "../core";
import { createToolContext, type ToolContext } from "../core/tool-context";
import { getPhasePrompt, INTERVIEW_PROMPT } from "../prompts/interview";
import { computePhase, type InterviewState } from "../schemas/interview";
import { buildAgentTools } from "../tools";

const MAX_STEPS = 15;

// ============================================
// Types
// ============================================

export interface InterviewAgentOptions {
  userId: string;
  courseId: string;
  messages?: import("ai").UIMessage[];
  personalization?: {
    personaPrompt?: string;
    userContext?: string;
  };
}

// ============================================
// Agent Factory
// ============================================

export function createInterviewAgent(
  options: InterviewAgentOptions,
): ToolLoopAgent<InterviewState, ToolSet> {
  if (!options.courseId) {
    throw new Error("Interview agent requires courseId");
  }

  const ctx: ToolContext = createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });

  const tools = buildAgentTools("interview", ctx) as ToolSet;

  const courseId = options.courseId;

  return new ToolLoopAgent<InterviewState, ToolSet>({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    tools,

    prepareCall: async ({ ...rest }) => {
      // 每步重新从数据库读取最新状态，确保工具更新后能正确推进阶段
      const session = await db.query.courseSessions.findFirst({
        where: eq(courseSessions.id, courseId),
        columns: { interviewProfile: true, outlineData: true },
      });

      const dbProfile = session?.interviewProfile as InterviewProfile | null;
      const currentState: InterviewState = dbProfile
        ? {
            goal: dbProfile.goal ?? null,
            background: dbProfile.background ?? null,
            outcome: dbProfile.outcome ?? null,
          }
        : { goal: null, background: null, outcome: null };

      const currentHasOutline = session?.outlineData != null;
      const phase = computePhase(currentState, currentHasOutline);
      const instructions = `${INTERVIEW_PROMPT}\n\n${getPhasePrompt(phase, currentState)}`;

      // 三个指标收集完成且未生成大纲，强制调用 confirmOutline
      if (phase === "ready") {
        return {
          ...rest,
          options: currentState,
          instructions,
          toolChoice: { type: "tool", toolName: "confirmOutline" },
        };
      }

      return { ...rest, options: currentState, instructions };
    },

    stopWhen: stepCountIs(MAX_STEPS),
  });
}

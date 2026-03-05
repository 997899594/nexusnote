/**
 * INTERVIEW Agent - v6 状态机驱动
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createToolContext, type ToolContext } from "../core/tool-context";
import { buildAgentTools } from "../tools";
import { type InterviewState, computePhase } from "../schemas/interview";
import { INTERVIEW_PROMPT, getPhasePrompt } from "../prompts/interview";

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

  return new ToolLoopAgent<InterviewState, ToolSet>({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    tools,

    // v6 标准：通过泛型定义 options 类型
    // prepareCall 的 options 参数类型由泛型 InterviewState 推断

    prepareCall: ({ options: state, ...rest }) => {
      const currentState = state ?? {};
      const phase = computePhase(currentState);

      const instructions = `${INTERVIEW_PROMPT}\n\n${getPhasePrompt(phase, currentState)}`;

      if (phase === "ready") {
        return {
          ...rest,
          instructions,
          toolChoice: { type: "tool", toolName: "confirmOutline" },
        };
      }

      return { ...rest, instructions };
    },

    stopWhen: stepCountIs(MAX_STEPS),
  });
}

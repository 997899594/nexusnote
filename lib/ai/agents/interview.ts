/**
 * INTERVIEW Agent - 简化版状态机
 *
 * 从数据库读取 interviewProfile，判断收集阶段
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
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
  // 从数据库读取的 profile，用于判断阶段
  profile?: InterviewState | null;
  // 是否已生成大纲
  hasOutline?: boolean;
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

  // 将 profile 和 hasOutline 存储在闭包中，供 prepareCall 使用
  const initialProfile: InterviewState = options.profile ?? {
    goal: null,
    background: null,
    outcome: null,
  };
  const hasOutline = options.hasOutline ?? false;

  return new ToolLoopAgent<InterviewState, ToolSet>({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    tools,

    prepareCall: ({ options: state, ...rest }) => {
      // 首次调用时使用从数据库读取的 profile
      // 后续调用时 state 会被更新（通过 updateProfile 工具）
      const currentState: InterviewState = state ?? initialProfile;
      const phase = computePhase(currentState, hasOutline);
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

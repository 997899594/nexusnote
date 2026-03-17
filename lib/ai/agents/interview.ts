// lib/ai/agents/interview.ts

import { hasToolCall, stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createToolContext } from "../core/tool-context";
import { INTERVIEW_PROMPT } from "../prompts/interview";
import { buildAgentTools } from "../tools";

const MAX_STEPS = 15;

// ============================================
// Types
// ============================================

export interface InterviewAgentOptions {
  userId: string;
  courseId: string;
  messages?: import("ai").UIMessage[];
}

// ============================================
// Agent Factory
// ============================================

export function createInterviewAgent(options: InterviewAgentOptions) {
  if (!options.courseId) {
    throw new Error("Interview agent requires courseId");
  }

  const ctx = createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });

  const tools = buildAgentTools("interview", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: aiProvider.chatModel,
    instructions: INTERVIEW_PROMPT,
    tools,
    stopWhen: [hasToolCall("suggestOptions"), stepCountIs(MAX_STEPS)],
  });
}

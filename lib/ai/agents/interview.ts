// lib/ai/agents/interview.ts

import { hasToolCall, stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { buildPromptInstructions, getCapabilityProfile, getModelForPolicy } from "../core";
import { buildToolsForProfile } from "../tools";

const MAX_STEPS = 15;

// ============================================
// Types
// ============================================

export interface InterviewAgentOptions {
  userId: string;
  courseId?: string;
  messages?: import("ai").UIMessage[];
}

// ============================================
// Agent Factory
// ============================================

export function createInterviewAgent(options: InterviewAgentOptions) {
  const profile = getCapabilityProfile("INTERVIEW");
  const tools = buildToolsForProfile("INTERVIEW", {
    userId: options.userId,
    resourceId: options.courseId ?? undefined,
    messages: options.messages,
  }) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: getModelForPolicy(profile.modelPolicy),
    instructions: buildPromptInstructions(profile.promptKey),
    tools,
    stopWhen: [hasToolCall("suggestOptions"), stepCountIs(Math.min(MAX_STEPS, profile.maxSteps))],
  });
}

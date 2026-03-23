// lib/ai/agents/interview.ts

import { hasToolCall, stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import {
  type AITelemetryContext,
  buildPromptInstructions,
  getCapabilityProfile,
  getModelForPolicy,
  recordAIUsage,
} from "../core";
import { buildToolsForProfile } from "../tools";

const MAX_STEPS = 15;

// ============================================
// Types
// ============================================

export interface InterviewAgentOptions {
  userId: string;
  courseId?: string;
  messages?: import("ai").UIMessage[];
  telemetry?: AITelemetryContext;
}

// ============================================
// Agent Factory
// ============================================

export function createInterviewAgent(options: InterviewAgentOptions) {
  const startedAt = Date.now();
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
    onFinish: async ({ totalUsage, steps, finishReason }) => {
      if (!options.telemetry) {
        return;
      }

      const toolNames = Array.from(
        new Set(
          steps.flatMap((step) =>
            (step.toolCalls ?? []).map((toolCall) => String(toolCall.toolName)),
          ),
        ),
      );

      await recordAIUsage({
        ...options.telemetry,
        usage: totalUsage,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...options.telemetry.metadata,
          finishReason,
          stepCount: steps.length,
          toolNames,
        },
      });
    },
  });
}

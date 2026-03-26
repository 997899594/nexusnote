import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import { type AITelemetryContext, getPlainModelForPolicy, recordAIUsage } from "@/lib/ai/core";
import { createToolContext } from "@/lib/ai/core/tool-context";
import type { InterviewOutline } from "@/lib/ai/interview";
import { buildInterviewAgentInstructions } from "@/lib/ai/interview/prompts";
import { createInterviewTools } from "@/lib/ai/tools/interview";

const MAX_STEPS = 12;

export interface InterviewAgentOptions {
  userId: string;
  courseId?: string;
  currentOutline?: InterviewOutline;
  messages?: UIMessage[];
  telemetry?: AITelemetryContext;
}

export function createInterviewAgent(options: InterviewAgentOptions) {
  const startedAt = Date.now();
  const tools = createInterviewTools(
    createToolContext({
      userId: options.userId,
      resourceId: options.courseId,
      messages: options.messages,
    }),
    {
      currentOutline: options.currentOutline,
    },
  );

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: getPlainModelForPolicy("interactive-fast"),
    instructions: buildInterviewAgentInstructions({
      currentOutline: options.currentOutline,
    }),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
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

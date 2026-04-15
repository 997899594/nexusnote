import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import {
  type AITelemetryContext,
  getToolCallingModelForPolicy,
  recordAIUsage,
} from "@/lib/ai/core";
import { createToolContext } from "@/lib/ai/core/tool-context";
import type { InterviewOutline } from "@/lib/ai/interview";
import { buildInterviewAgentInstructionsWithHint } from "@/lib/ai/interview/prompts";
import { createInterviewTools } from "@/lib/ai/tools/interview";
import type { GrowthGenerationContext } from "@/lib/growth/generation-context-format";

const MAX_STEPS = 12;

export interface InterviewAgentOptions {
  userId: string;
  courseId?: string;
  currentOutline?: InterviewOutline;
  messages?: UIMessage[];
  generationContext?: GrowthGenerationContext;
  telemetry?: AITelemetryContext;
}

function shouldPreferOutlinePreview(latestUserMessage?: string) {
  if (!latestUserMessage) {
    return false;
  }

  const normalized = latestUserMessage.replace(/\s+/g, "");
  const mentionsFoundation = /我会|有.*基础|做过|接触过|懂|熟悉|掌握|学过|会一点|会一些/.test(
    normalized,
  );
  const mentionsConcreteDeliverable =
    /作品集|项目|应用|网站|后台|系统|工具|案例|平台|dashboard|portfolio|demo/.test(
      normalized.toLowerCase(),
    );
  const mentionsTopic =
    /react|vue|next|fastapi|python|sql|数据分析|可视化|ai|机器学习|前端|后端/.test(
      normalized.toLowerCase(),
    );

  return mentionsFoundation && mentionsConcreteDeliverable && mentionsTopic;
}

export function createInterviewAgent(options: InterviewAgentOptions) {
  const startedAt = Date.now();
  const latestUserMessage = [...(options.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user")
    ?.parts.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
  const preferOutlinePreview =
    !options.currentOutline && shouldPreferOutlinePreview(latestUserMessage);

  const tools = createInterviewTools(
    createToolContext({
      userId: options.userId,
      resourceId: options.courseId,
      messages: options.messages,
    }),
  );

  return new ToolLoopAgent({
    id: "nexusnote-interview",
    model: getToolCallingModelForPolicy("interactive-fast"),
    instructions: buildInterviewAgentInstructionsWithHint({
      currentOutline: options.currentOutline,
      latestUserMessage,
      preferOutlinePreview,
      generationContext: options.generationContext,
    }),
    tools,
    toolChoice: "required",
    stopWhen: [
      stepCountIs(MAX_STEPS),
      ({ steps }) =>
        steps[steps.length - 1]?.toolCalls?.some(
          (toolCall) =>
            toolCall.toolName === "presentOptions" || toolCall.toolName === "presentOutlinePreview",
        ) ?? false,
    ],
    prepareStep: async () => ({
      activeTools: preferOutlinePreview
        ? ["presentOutlinePreview"]
        : ["presentOptions", "presentOutlinePreview"],
      toolChoice: "required",
    }),
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

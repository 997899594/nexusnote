import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import { getToolCallingModelForPolicy, type ModelPolicy } from "@/lib/ai/core/model-policy";
import { type AITelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import { createToolContext } from "@/lib/ai/core/tool-context";
import { buildInterviewAgentInstructionsWithHint } from "@/lib/ai/interview/prompts";
import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import type { InterviewTimingSink } from "@/lib/ai/interview/timing";
import { extractUIMessageText } from "@/lib/ai/message-text";
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
  timing?: InterviewTimingSink;
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
  options.timing?.mark("agent.create.start", { mode: "natural" });
  const latestUserTurn = [...(options.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user");
  const latestUserMessage = latestUserTurn
    ? extractUIMessageText(latestUserTurn, { separator: "" })
    : undefined;
  const preferOutlinePreview =
    !options.currentOutline && shouldPreferOutlinePreview(latestUserMessage);
  const modelPolicy: ModelPolicy =
    preferOutlinePreview || options.currentOutline ? "outline-architect" : "interactive-fast";
  options.timing?.mark("natural.intent-hint.resolved", {
    hasCurrentOutline: Boolean(options.currentOutline),
    preferOutlinePreview,
  });

  const tools = createInterviewTools(
    createToolContext({
      userId: options.userId,
      resourceId: options.courseId,
      messages: options.messages,
    }),
  );
  options.timing?.mark("agent.tools.ready", { mode: "natural" });

  const agent = new ToolLoopAgent({
    id: "nexusnote-interview",
    model: getToolCallingModelForPolicy(modelPolicy),
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
      options.timing?.mark("agent.finish", {
        mode: "natural",
        finishReason,
        stepCount: steps.length,
      });
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

      void recordAIUsage({
        ...options.telemetry,
        modelPolicy,
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
  options.timing?.mark("agent.create.end", { mode: "natural" });

  return agent;
}

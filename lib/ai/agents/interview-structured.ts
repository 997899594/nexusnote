import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import { getToolCallingModelForPolicy } from "@/lib/ai/core/model-policy";
import { type AITelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import { createToolContext } from "@/lib/ai/core/tool-context";
import { evaluateInterviewSufficiency } from "@/lib/ai/interview/evaluate-sufficiency";
import { extractInterviewState } from "@/lib/ai/interview/extract-state";
import { extractLatestUserMessageFromUIMessages } from "@/lib/ai/interview/message-history";
import type { InterviewApiMessage, InterviewOutline } from "@/lib/ai/interview/schemas";
import { buildStructuredInterviewAgentInstructions } from "@/lib/ai/interview/structured-prompts";
import { getInterviewMessageText } from "@/lib/ai/interview/ui";
import { validateOutlineForState } from "@/lib/ai/interview/validate-outline";
import { createStructuredInterviewTools } from "@/lib/ai/tools/interview-structured";
import type { GrowthGenerationContext } from "@/lib/growth/generation-context-format";

const STRUCTURED_MAX_STEPS = 6;

export interface StructuredInterviewAgentOptions {
  userId: string;
  courseId?: string;
  currentOutline?: InterviewOutline;
  messages?: UIMessage[];
  generationContext?: GrowthGenerationContext;
  telemetry?: AITelemetryContext;
}

function shouldStopAfterVisibleTool(steps: Array<{ toolCalls?: Array<{ toolName?: string }> }>) {
  return (
    steps[steps.length - 1]?.toolCalls?.some(
      (toolCall) =>
        toolCall.toolName === "presentOptions" || toolCall.toolName === "presentOutlinePreview",
    ) ?? false
  );
}

function toInterviewApiMessages(messages?: UIMessage[]): InterviewApiMessage[] {
  return (messages ?? [])
    .filter(
      (
        message,
      ): message is UIMessage & {
        role: "user" | "assistant";
      } => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: getInterviewMessageText(message),
    }))
    .filter((message) => message.text.length > 0);
}

function buildBaseToolContext(options: StructuredInterviewAgentOptions) {
  return createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });
}

export async function createStructuredInterviewAgent(options: StructuredInterviewAgentOptions) {
  const startedAt = Date.now();
  const latestUserMessage = extractLatestUserMessageFromUIMessages(options.messages);
  const apiMessages = toInterviewApiMessages(options.messages);
  const state = await extractInterviewState({
    messages: apiMessages,
    currentOutline: options.currentOutline,
  });
  const sufficiency = evaluateInterviewSufficiency(state, {
    currentOutline: options.currentOutline,
  });
  const tools = createStructuredInterviewTools(buildBaseToolContext(options), {
    forcedQuestionTargetField: sufficiency.allowOutline ? undefined : sufficiency.nextFocus,
    validateOutline: (outline) => validateOutlineForState(outline, state),
  });

  return new ToolLoopAgent({
    id: "nexusnote-interview-structured",
    model: getToolCallingModelForPolicy("interactive-fast"),
    instructions: buildStructuredInterviewAgentInstructions({
      messages: apiMessages,
      currentOutline: options.currentOutline,
      state,
      sufficiency,
      latestUserMessage,
      generationContext: options.generationContext,
    }),
    tools,
    toolChoice: "required",
    stopWhen: [stepCountIs(STRUCTURED_MAX_STEPS), ({ steps }) => shouldStopAfterVisibleTool(steps)],
    prepareStep: async () => ({
      activeTools: sufficiency.allowOutline ? ["presentOutlinePreview"] : ["presentOptions"],
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
        modelPolicy: "interactive-fast",
        usage: totalUsage,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...options.telemetry.metadata,
          finishReason,
          stepCount: steps.length,
          sessionMode: "structured",
          interviewPhase: state.phase,
          allowOutline: sufficiency.allowOutline,
          nextFocus: sufficiency.nextFocus,
          toolNames,
        },
      });
    },
  });
}

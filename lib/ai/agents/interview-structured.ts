import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import { getToolCallingModelForPolicy, type ModelPolicy } from "@/lib/ai/core/model-policy";
import { type AITelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import { createToolContext } from "@/lib/ai/core/tool-context";
import { evaluateInterviewSufficiency } from "@/lib/ai/interview/evaluate-sufficiency";
import { extractInterviewState } from "@/lib/ai/interview/extract-state";
import { extractLatestUserMessageFromUIMessages } from "@/lib/ai/interview/message-history";
import type { InterviewApiMessage, InterviewOutline } from "@/lib/ai/interview/schemas";
import { buildStructuredInterviewAgentInstructions } from "@/lib/ai/interview/structured-prompts";
import type { InterviewTimingSink } from "@/lib/ai/interview/timing";
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
  timing?: InterviewTimingSink;
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
  options.timing?.mark("agent.create.start", { mode: "structured" });
  options.timing?.mark("messages.normalize.start");
  const latestUserMessage = extractLatestUserMessageFromUIMessages(options.messages);
  const apiMessages = toInterviewApiMessages(options.messages);
  options.timing?.mark("messages.normalize.end", { messageCount: apiMessages.length });
  options.timing?.mark("state.extract.start");
  const state = await extractInterviewState({
    messages: apiMessages,
    currentOutline: options.currentOutline,
    timing: options.timing,
  });
  options.timing?.mark("state.extract.end", {
    phase: state.phase,
    confidence: state.confidence,
  });
  options.timing?.mark("sufficiency.evaluate.start");
  const sufficiency = evaluateInterviewSufficiency(state, {
    currentOutline: options.currentOutline,
  });
  options.timing?.mark("sufficiency.evaluate.end", {
    allowOutline: sufficiency.allowOutline,
    nextFocus: sufficiency.nextFocus,
  });
  options.timing?.mark("agent.tools.start");
  const tools = createStructuredInterviewTools(buildBaseToolContext(options), {
    forcedQuestionTargetField: sufficiency.allowOutline ? undefined : sufficiency.nextFocus,
    validateOutline: (outline) => validateOutlineForState(outline, state),
  });
  options.timing?.mark("agent.tools.end");
  options.timing?.mark("instructions.build.start");
  const instructions = buildStructuredInterviewAgentInstructions({
    messages: apiMessages,
    currentOutline: options.currentOutline,
    state,
    sufficiency,
    latestUserMessage,
    generationContext: options.generationContext,
  });
  options.timing?.mark("instructions.build.end", { length: instructions.length });
  const modelPolicy: ModelPolicy = sufficiency.allowOutline
    ? "outline-architect"
    : "interactive-fast";

  const agent = new ToolLoopAgent({
    id: "nexusnote-interview-structured",
    model: getToolCallingModelForPolicy(modelPolicy),
    instructions,
    tools,
    toolChoice: "required",
    stopWhen: [stepCountIs(STRUCTURED_MAX_STEPS), ({ steps }) => shouldStopAfterVisibleTool(steps)],
    prepareStep: async () => ({
      activeTools: sufficiency.allowOutline ? ["presentOutlinePreview"] : ["presentOptions"],
      toolChoice: "required",
    }),
    onFinish: async ({ totalUsage, steps, finishReason }) => {
      options.timing?.mark("agent.finish", {
        mode: "structured",
        finishReason,
        stepCount: steps.length,
        phase: state.phase,
        allowOutline: sufficiency.allowOutline,
        nextFocus: sufficiency.nextFocus,
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
          sessionMode: "structured",
          interviewPhase: state.phase,
          allowOutline: sufficiency.allowOutline,
          nextFocus: sufficiency.nextFocus,
          toolNames,
        },
      });
    },
  });
  options.timing?.mark("agent.create.end", { mode: "structured" });

  return agent;
}

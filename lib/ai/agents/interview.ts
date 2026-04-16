import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import {
  type AITelemetryContext,
  getToolCallingModelForPolicy,
  recordAIUsage,
} from "@/lib/ai/core";
import { createToolContext } from "@/lib/ai/core/tool-context";
import {
  buildNaturalInterviewAgentInstructions,
  buildStructuredInterviewAgentInstructions,
  DEFAULT_INTERVIEW_SESSION_MODE,
  evaluateInterviewSufficiency,
  extractInterviewState,
  getInterviewMessageText,
  type InterviewApiMessage,
  type InterviewOutline,
  type InterviewSessionMode,
  normalizeInterviewSessionMode,
  validateOutlineForState,
} from "@/lib/ai/interview";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { createInterviewTools } from "@/lib/ai/tools/interview";
import type { GrowthGenerationContext } from "@/lib/growth/generation-context-format";

const NATURAL_MAX_STEPS = 12;
const STRUCTURED_MAX_STEPS = 6;

export interface InterviewAgentOptions {
  userId: string;
  courseId?: string;
  currentOutline?: InterviewOutline;
  messages?: UIMessage[];
  mode?: InterviewSessionMode;
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

function extractLatestUserMessage(messages?: UIMessage[]) {
  const latestUserTurn = [...(messages ?? [])].reverse().find((message) => message.role === "user");
  return latestUserTurn ? extractUIMessageText(latestUserTurn, { separator: "" }) : undefined;
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

function shouldPreferOutlinePreview(latestUserMessage?: string) {
  if (!latestUserMessage) {
    return false;
  }

  const normalized = latestUserMessage.replace(/\s+/g, "");
  const mentionsTopic =
    normalized.includes("学") ||
    normalized.includes("做") ||
    normalized.includes("准备") ||
    normalized.includes("练") ||
    normalized.includes("提升");
  const mentionsOutcome = /想(达到|做到|完成|解决)|希望|目标|为了|用来|独立|拿下|通过|做出/.test(
    normalized,
  );
  const mentionsBaseline = /零基础|有基础|做过|学过|会一点|接触过|熟悉|正在做|有经验/.test(
    normalized,
  );

  return mentionsTopic && mentionsOutcome && mentionsBaseline;
}

function buildBaseToolContext(options: InterviewAgentOptions) {
  return createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
    messages: options.messages,
  });
}

function createNaturalInterviewAgent(options: InterviewAgentOptions) {
  const startedAt = Date.now();
  const latestUserMessage = extractLatestUserMessage(options.messages);
  const preferOutlinePreview =
    !options.currentOutline && shouldPreferOutlinePreview(latestUserMessage);

  const tools = createInterviewTools(buildBaseToolContext(options));

  return new ToolLoopAgent({
    id: "nexusnote-interview-natural",
    model: getToolCallingModelForPolicy("interactive-fast"),
    instructions: buildNaturalInterviewAgentInstructions({
      currentOutline: options.currentOutline,
      latestUserMessage,
      preferOutlinePreview,
      generationContext: options.generationContext,
    }),
    tools,
    toolChoice: "required",
    stopWhen: [stepCountIs(NATURAL_MAX_STEPS), ({ steps }) => shouldStopAfterVisibleTool(steps)],
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
          sessionMode: "natural",
          toolNames,
        },
      });
    },
  });
}

async function createStructuredInterviewAgent(options: InterviewAgentOptions) {
  const startedAt = Date.now();
  const latestUserMessage = extractLatestUserMessage(options.messages);
  const apiMessages = toInterviewApiMessages(options.messages);
  const state = await extractInterviewState({
    messages: apiMessages,
    currentOutline: options.currentOutline,
  });
  const sufficiency = evaluateInterviewSufficiency(state, options.currentOutline);
  const tools = createInterviewTools(buildBaseToolContext(options), {
    forcedQuestionTargetField: sufficiency.allowOutline ? undefined : sufficiency.nextFocus,
    validateOutline: (outline) => validateOutlineForState(outline, state),
  });

  return new ToolLoopAgent({
    id: "nexusnote-interview-structured",
    model: getToolCallingModelForPolicy("structured-high-quality"),
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

export async function createInterviewAgent(options: InterviewAgentOptions) {
  const mode = normalizeInterviewSessionMode(options.mode ?? DEFAULT_INTERVIEW_SESSION_MODE);

  if (mode === "structured") {
    return createStructuredInterviewAgent({
      ...options,
      mode,
    });
  }

  return createNaturalInterviewAgent({
    ...options,
    mode,
  });
}

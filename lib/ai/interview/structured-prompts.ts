import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import type {
  InterviewApiMessage,
  InterviewOutline,
  InterviewState,
  InterviewSufficiency,
} from "./schemas";

const STRUCTURED_STATE_SYSTEM_PROMPT = loadPromptResource("interview-state-system.md");
const STRUCTURED_INTERVIEW_SYSTEM_PROMPT = loadPromptResource("interview-structured-system.md");
const STRUCTURED_STATE_USER_PROMPT = "interview-state-user.md";
const STRUCTURED_INTERVIEW_USER_PROMPT = "interview-structured-user.md";
const STRUCTURED_FOCUS_GUIDANCE_PROMPTS = {
  topic: loadPromptResource("interview/focus-topic.md"),
  targetOutcome: loadPromptResource("interview/focus-target-outcome.md"),
  currentBaseline: loadPromptResource("interview/focus-current-baseline.md"),
  constraints: loadPromptResource("interview/focus-constraints.md"),
  constraintsWithExisting: loadPromptResource("interview/focus-constraints-existing.md"),
  revision: loadPromptResource("interview/focus-revision.md"),
} as const;

function formatConversation(messages: InterviewApiMessage[]) {
  return messages
    .map((message) => `${message.role === "user" ? "用户" : "助理"}: ${message.text}`)
    .join("\n");
}

function formatOutline(outline: InterviewOutline | undefined) {
  return outline ? JSON.stringify(outline, null, 2) : "暂无已生成大纲。";
}

function buildFocusGuidance(
  nextFocus: InterviewSufficiency["nextFocus"],
  state: InterviewState,
): string {
  switch (nextFocus) {
    case "topic":
      return STRUCTURED_FOCUS_GUIDANCE_PROMPTS.topic;
    case "targetOutcome":
      return STRUCTURED_FOCUS_GUIDANCE_PROMPTS.targetOutcome;
    case "currentBaseline":
      return STRUCTURED_FOCUS_GUIDANCE_PROMPTS.currentBaseline;
    case "constraints":
      return state.constraints.length > 0
        ? STRUCTURED_FOCUS_GUIDANCE_PROMPTS.constraintsWithExisting
        : STRUCTURED_FOCUS_GUIDANCE_PROMPTS.constraints;
    case "revision":
      return STRUCTURED_FOCUS_GUIDANCE_PROMPTS.revision;
    default:
      return "";
  }
}

export function buildStructuredInterviewStatePrompt(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}) {
  return renderPromptResource(STRUCTURED_STATE_USER_PROMPT, {
    conversation_history: formatConversation(input.messages),
    current_outline: formatOutline(input.currentOutline),
  });
}

export function buildStructuredInterviewAgentInstructions(input: {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
  state: InterviewState;
  sufficiency: InterviewSufficiency;
  latestUserMessage?: string;
  generationContext?: GrowthGenerationContext;
}) {
  const action = input.sufficiency.allowOutline ? "outline" : "question";
  const focusGuidance =
    action === "question" ? buildFocusGuidance(input.sufficiency.nextFocus, input.state) : null;
  return [
    STRUCTURED_INTERVIEW_SYSTEM_PROMPT,
    renderPromptResource(STRUCTURED_INTERVIEW_USER_PROMPT, {
      conversation_history: formatConversation(input.messages),
      current_outline: formatOutline(input.currentOutline),
      interview_state: JSON.stringify(input.state, null, 2),
      interview_sufficiency: JSON.stringify(input.sufficiency, null, 2),
      action,
      focus:
        action === "question" ? (input.sufficiency.nextFocus ?? "未明确") : "直接生成完整课程草案",
      focus_guidance: focusGuidance ?? "",
      known_topic: input.state.topic ?? "未明确",
      known_target_outcome: input.state.targetOutcome ?? "未明确",
      known_current_baseline: input.state.currentBaseline ?? "未明确",
      known_constraints:
        input.state.constraints.length > 0 ? input.state.constraints.join("、") : "未明确",
      revision_intent: input.state.revisionIntent ?? "无",
      growth_context: formatGrowthGenerationContext(input.generationContext, { style: "detailed" }),
      latest_user_message: input.latestUserMessage?.trim() || "无",
    }),
  ].join("\n\n");
}

export { STRUCTURED_INTERVIEW_SYSTEM_PROMPT, STRUCTURED_STATE_SYSTEM_PROMPT };

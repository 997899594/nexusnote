import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import type { InterviewOutline } from "./schemas";

const INTERVIEW_SYSTEM_PROMPT = loadPromptResource("interview-system.md");
const INTERVIEW_NATURAL_USER_PROMPT = "interview/natural-user.md";
const INTERVIEW_NATURAL_CURRENT_OUTLINE_PROMPT = "interview/natural-current-outline.md";
const INTERVIEW_NATURAL_NO_OUTLINE_PROMPT = loadPromptResource("interview/natural-no-outline.md");
const INTERVIEW_NATURAL_HINTS = {
  roleTransition: loadPromptResource("interview/natural-first-question-role-transition.md"),
  focusOnly: loadPromptResource("interview/natural-first-question-focus-only.md"),
  focusWithTarget: loadPromptResource("interview/natural-first-question-focus-with-target.md"),
  preferOutlinePreview: loadPromptResource("interview/natural-prefer-outline-preview.md"),
  existingOutlineRules: loadPromptResource("interview/natural-existing-outline-rules.md"),
} as const;

function buildFirstQuestionHint(latestUserMessage?: string) {
  if (!latestUserMessage) {
    return "";
  }

  const normalized = latestUserMessage.replace(/\s+/g, "");
  const mentionsRoleTransition = /转行|转岗|从.+转|找工作|求职|面试|岗位/.test(normalized);
  const mentionsSpecificFocus =
    /重点|主要|尤其|并做|作品集|项目|SQL|Python|React|可视化|数据分析|AI/.test(normalized);
  const mentionsTargetOutcome = /作品集|项目|面试|找工作|转岗|转行|应用|落地|提升/.test(normalized);

  if (mentionsRoleTransition) {
    return INTERVIEW_NATURAL_HINTS.roleTransition;
  }

  if (mentionsSpecificFocus && !mentionsTargetOutcome) {
    return INTERVIEW_NATURAL_HINTS.focusOnly;
  }

  if (mentionsSpecificFocus && mentionsTargetOutcome) {
    return INTERVIEW_NATURAL_HINTS.focusWithTarget;
  }

  return "";
}

export function buildInterviewAgentInstructionsWithHint(input: {
  currentOutline?: InterviewOutline;
  latestUserMessage?: string;
  preferOutlinePreview?: boolean;
  generationContext?: GrowthGenerationContext;
}) {
  const firstQuestionHint = buildFirstQuestionHint(input.latestUserMessage);
  const currentOutlineBlock = input.currentOutline
    ? renderPromptResource(INTERVIEW_NATURAL_CURRENT_OUTLINE_PROMPT, {
        current_outline_json: JSON.stringify(input.currentOutline, null, 2),
      })
    : INTERVIEW_NATURAL_NO_OUTLINE_PROMPT;

  return [
    INTERVIEW_SYSTEM_PROMPT,
    renderPromptResource(INTERVIEW_NATURAL_USER_PROMPT, {
      current_outline_block: currentOutlineBlock,
      growth_context: formatGrowthGenerationContext(input.generationContext, { style: "detailed" }),
      first_question_hint: firstQuestionHint,
      prefer_outline_preview_block: input.preferOutlinePreview
        ? INTERVIEW_NATURAL_HINTS.preferOutlinePreview
        : "",
      existing_outline_rules_block: input.currentOutline
        ? INTERVIEW_NATURAL_HINTS.existingOutlineRules
        : "",
    }),
  ].join("\n\n");
}

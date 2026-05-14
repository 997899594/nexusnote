import type { Agent, ToolSet } from "ai";
import type { CapabilityMode, ConversationCapabilityMode } from "@/lib/ai/runtime/contracts";
import { careerGuideSpecialistSpec, createCareerGuideSpecialist } from "./career";
import type {
  ConversationSpecialistAgentOptions,
  ConversationSpecialistRuntimeSpec,
} from "./conversation-agent";
import { createGeneralChatSpecialist, generalChatSpecialistSpec } from "./general";
import {
  type CourseInterviewerSpecialistOptions,
  type CourseInterviewerSpecialistSpec,
  courseInterviewerSpecialistSpec,
  createCourseInterviewerSpecialist,
} from "./interview";
import { createLearnCoachSpecialist, learnCoachSpecialistSpec } from "./learn";
import { createNoteAssistantSpecialist, noteAssistantSpecialistSpec } from "./notes";
import { createResearchAssistantSpecialist, researchAssistantSpecialistSpec } from "./research";

export type SpecialistSpec = ConversationSpecialistRuntimeSpec | CourseInterviewerSpecialistSpec;

const CONVERSATION_SPECIALIST_SPECS: Record<
  ConversationCapabilityMode,
  ConversationSpecialistRuntimeSpec
> = {
  general_chat: generalChatSpecialistSpec,
  learn_coach: learnCoachSpecialistSpec,
  note_assistant: noteAssistantSpecialistSpec,
  research_assistant: researchAssistantSpecialistSpec,
  career_guide: careerGuideSpecialistSpec,
};

const SPECIALIST_SPECS: Record<CapabilityMode, SpecialistSpec> = {
  ...CONVERSATION_SPECIALIST_SPECS,
  course_interviewer: courseInterviewerSpecialistSpec,
};

export function getConversationSpecialistSpec(
  mode: ConversationCapabilityMode,
): ConversationSpecialistRuntimeSpec {
  return CONVERSATION_SPECIALIST_SPECS[mode];
}

export function getSpecialistSpec(mode: CapabilityMode): SpecialistSpec {
  return SPECIALIST_SPECS[mode];
}

export async function createConversationSpecialistAgent(params: {
  mode: ConversationCapabilityMode;
  options?: ConversationSpecialistAgentOptions;
}): Promise<Agent<never, ToolSet, never>> {
  switch (params.mode) {
    case "general_chat":
      return createGeneralChatSpecialist(params.options) as Promise<Agent<never, ToolSet, never>>;
    case "learn_coach":
      return createLearnCoachSpecialist(params.options) as Promise<Agent<never, ToolSet, never>>;
    case "note_assistant":
      return createNoteAssistantSpecialist(params.options) as Promise<Agent<never, ToolSet, never>>;
    case "research_assistant":
      return createResearchAssistantSpecialist(params.options) as Promise<
        Agent<never, ToolSet, never>
      >;
    case "career_guide":
      return createCareerGuideSpecialist(params.options) as Promise<Agent<never, ToolSet, never>>;
  }
}

export function createCourseInterviewerSpecialistAgent(
  options: CourseInterviewerSpecialistOptions,
): Agent<never, ToolSet, never> {
  return createCourseInterviewerSpecialist(options) as unknown as Agent<never, ToolSet, never>;
}

export async function createSpecialistAgent(
  params:
    | {
        mode: ConversationCapabilityMode;
        options?: ConversationSpecialistAgentOptions;
      }
    | {
        mode: "course_interviewer";
        options: CourseInterviewerSpecialistOptions;
      },
): Promise<Agent<never, ToolSet, never>> {
  if (params.mode === "course_interviewer") {
    return createCourseInterviewerSpecialistAgent(params.options);
  }

  return createConversationSpecialistAgent({
    mode: params.mode,
    options: params.options,
  });
}

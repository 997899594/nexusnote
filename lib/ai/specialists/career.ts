import {
  type ConversationSpecialistAgentOptions,
  type ConversationSpecialistRuntimeSpec,
  createConversationToolLoopSpecialist,
} from "./conversation-agent";

export const careerGuideSpecialistSpec: ConversationSpecialistRuntimeSpec = {
  mode: "career_guide",
  authRequired: true,
  resourceRequired: false,
  modelPolicy: "interactive-fast",
  promptKey: "career-guide@v1",
  promptVersion: "career-guide@v1",
  maxSteps: 10,
  preferToolCallingModel: true,
  growthContextStyle: "detailed",
};

export async function createCareerGuideSpecialist(
  options: ConversationSpecialistAgentOptions = {},
) {
  return createConversationToolLoopSpecialist(careerGuideSpecialistSpec, options);
}

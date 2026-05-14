import {
  type ConversationSpecialistAgentOptions,
  type ConversationSpecialistRuntimeSpec,
  createConversationToolLoopSpecialist,
} from "./conversation-agent";

export const researchAssistantSpecialistSpec: ConversationSpecialistRuntimeSpec = {
  mode: "research_assistant",
  authRequired: true,
  resourceRequired: false,
  modelPolicy: "interactive-fast",
  promptKey: "research-assist@v1",
  promptVersion: "research-assist@v1",
  maxSteps: 10,
  preferToolCallingModel: true,
  growthContextStyle: "none",
};

export async function createResearchAssistantSpecialist(
  options: ConversationSpecialistAgentOptions = {},
) {
  return createConversationToolLoopSpecialist(researchAssistantSpecialistSpec, options);
}

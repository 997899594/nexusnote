import {
  type ConversationSpecialistAgentOptions,
  type ConversationSpecialistRuntimeSpec,
  createConversationToolLoopSpecialist,
} from "./conversation-agent";

export const learnCoachSpecialistSpec: ConversationSpecialistRuntimeSpec = {
  mode: "learn_coach",
  authRequired: true,
  resourceRequired: true,
  modelPolicy: "interactive-fast",
  promptKey: "learn-assist@v1",
  promptVersion: "learn-assist@v1",
  maxSteps: 10,
  preferToolCallingModel: true,
  growthContextStyle: "none",
};

export async function createLearnCoachSpecialist(options: ConversationSpecialistAgentOptions = {}) {
  return createConversationToolLoopSpecialist(learnCoachSpecialistSpec, options);
}

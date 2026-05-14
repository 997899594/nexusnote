import {
  type ConversationSpecialistAgentOptions,
  type ConversationSpecialistRuntimeSpec,
  createConversationToolLoopSpecialist,
} from "./conversation-agent";

export const generalChatSpecialistSpec: ConversationSpecialistRuntimeSpec = {
  mode: "general_chat",
  authRequired: true,
  resourceRequired: false,
  modelPolicy: "interactive-fast",
  promptKey: "chat-basic@v1",
  promptVersion: "chat-basic@v1",
  maxSteps: 12,
  preferToolCallingModel: false,
  growthContextStyle: "none",
};

export async function createGeneralChatSpecialist(
  options: ConversationSpecialistAgentOptions = {},
) {
  return createConversationToolLoopSpecialist(generalChatSpecialistSpec, options);
}

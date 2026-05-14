import {
  type ConversationSpecialistAgentOptions,
  type ConversationSpecialistRuntimeSpec,
  createConversationToolLoopSpecialist,
} from "./conversation-agent";

export const noteAssistantSpecialistSpec: ConversationSpecialistRuntimeSpec = {
  mode: "note_assistant",
  authRequired: true,
  resourceRequired: false,
  modelPolicy: "interactive-fast",
  promptKey: "note-assist@v1",
  promptVersion: "note-assist@v1",
  maxSteps: 10,
  preferToolCallingModel: false,
};

export async function createNoteAssistantSpecialist(
  options: ConversationSpecialistAgentOptions = {},
) {
  return createConversationToolLoopSpecialist(noteAssistantSpecialistSpec, options);
}

import type { ModelPolicy } from "./model-policy";
import type { PromptKey } from "./prompt-registry";

export type AgentProfile = "CHAT_BASIC" | "LEARN_ASSIST" | "NOTE_ASSIST";

export interface CapabilityProfileDefinition {
  id: AgentProfile;
  authRequired: boolean;
  resourceRequired: boolean;
  modelPolicy: ModelPolicy;
  promptKey: PromptKey;
  maxSteps: number;
}

const CAPABILITY_PROFILES: Record<AgentProfile, CapabilityProfileDefinition> = {
  CHAT_BASIC: {
    id: "CHAT_BASIC",
    authRequired: false,
    resourceRequired: false,
    modelPolicy: "interactive-fast",
    promptKey: "chat-basic@v1",
    maxSteps: 12,
  },
  LEARN_ASSIST: {
    id: "LEARN_ASSIST",
    authRequired: true,
    resourceRequired: true,
    modelPolicy: "interactive-fast",
    promptKey: "learn-assist@v1",
    maxSteps: 10,
  },
  NOTE_ASSIST: {
    id: "NOTE_ASSIST",
    authRequired: true,
    resourceRequired: false,
    modelPolicy: "interactive-fast",
    promptKey: "note-assist@v1",
    maxSteps: 10,
  },
};

export function getCapabilityProfile(profile: AgentProfile): CapabilityProfileDefinition {
  return CAPABILITY_PROFILES[profile];
}

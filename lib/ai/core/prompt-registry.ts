import { buildInstructions, CHAT_PROMPT } from "@/lib/ai/prompts/chat";
import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";

export type PromptKey = "chat-basic@v1" | "learn-assist@v1" | "note-assist@v1";

interface PromptDefinition {
  key: PromptKey;
  systemPrompt: string;
}

const LEARN_ASSIST_PROMPT = loadPromptResource("learn-assist.md");
const NOTE_ASSIST_PROMPT = loadPromptResource("note-assist.md");

const PROMPTS: Record<PromptKey, PromptDefinition> = {
  "chat-basic@v1": {
    key: "chat-basic@v1",
    systemPrompt: CHAT_PROMPT,
  },
  "learn-assist@v1": {
    key: "learn-assist@v1",
    systemPrompt: LEARN_ASSIST_PROMPT,
  },
  "note-assist@v1": {
    key: "note-assist@v1",
    systemPrompt: NOTE_ASSIST_PROMPT,
  },
};

export function getPromptDefinition(key: PromptKey): PromptDefinition {
  return PROMPTS[key];
}

export function buildPromptInstructions(
  key: PromptKey,
  personalization?: {
    behaviorPrompt?: string;
    skinPrompt?: string;
    userContext?: string;
  },
): string {
  return buildInstructions(getPromptDefinition(key).systemPrompt, personalization);
}

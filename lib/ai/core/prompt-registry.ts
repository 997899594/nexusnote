import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";

export type PromptKey =
  | "chat-basic@v1"
  | "learn-assist@v1"
  | "note-assist@v1"
  | "research-assist@v1"
  | "career-guide@v1";

interface PromptDefinition {
  key: PromptKey;
  systemPrompt: string;
}

const CHAT_PROMPT = loadPromptResource("chat-basic.md");
const LEARN_ASSIST_PROMPT = loadPromptResource("learn-assist.md");
const NOTE_ASSIST_PROMPT = loadPromptResource("note-assist.md");
const RESEARCH_ASSIST_PROMPT = loadPromptResource("research-assist.md");
const CAREER_GUIDE_PROMPT = loadPromptResource("career-guide.md");

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
  "research-assist@v1": {
    key: "research-assist@v1",
    systemPrompt: RESEARCH_ASSIST_PROMPT,
  },
  "career-guide@v1": {
    key: "career-guide@v1",
    systemPrompt: CAREER_GUIDE_PROMPT,
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
  return [
    getPromptDefinition(key).systemPrompt,
    personalization?.behaviorPrompt,
    personalization?.skinPrompt,
    personalization?.userContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

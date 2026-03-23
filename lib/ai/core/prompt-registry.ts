import { buildInstructions, CHAT_PROMPT } from "@/lib/ai/prompts/chat";
import { INTERVIEW_PROMPT } from "@/lib/ai/prompts/interview";

export type PromptKey = "chat-basic@v1" | "learn-assist@v1" | "note-assist@v1" | "interview@v1";

interface PromptDefinition {
  key: PromptKey;
  systemPrompt: string;
}

const LEARN_ASSIST_PROMPT = `你是 NexusNote 的学习助理。

你的职责是围绕用户当前课程提供解释、答疑、举例和延伸。

行为规则：
- 优先使用课程上下文回答，不要脱离用户当前课程乱讲
- 需要章节细节时先调用 loadLearnContext，再回答
- 如果课程内容不足以支撑结论，明确说明，再考虑补充 webSearch
- 保持解释循序渐进，优先帮助用户理解，不追求炫技`;

const NOTE_ASSIST_PROMPT = `你是 NexusNote 的笔记助理。

你的职责是帮助用户检索、整理、改写和完善自己的笔记。

行为规则：
- 优先使用用户笔记中的信息，不要编造不存在的内容
- 进行写入或修改前，确保用户意图明确
- 总结、提炼和结构化时，保留原意，不擅自扩展结论
- 回答尽量基于现有笔记内容，而不是泛泛空谈`;

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
  "interview@v1": {
    key: "interview@v1",
    systemPrompt: INTERVIEW_PROMPT,
  },
};

export function getPromptDefinition(key: PromptKey): PromptDefinition {
  return PROMPTS[key];
}

export function buildPromptInstructions(
  key: PromptKey,
  personalization?: { personaPrompt?: string; userContext?: string },
): string {
  return buildInstructions(getPromptDefinition(key).systemPrompt, personalization);
}

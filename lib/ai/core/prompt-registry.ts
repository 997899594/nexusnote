import { buildInstructions, CHAT_PROMPT } from "@/lib/ai/prompts/chat";

export type PromptKey = "chat-basic@v1" | "learn-assist@v1" | "note-assist@v1";

interface PromptDefinition {
  key: PromptKey;
  systemPrompt: string;
}

const LEARN_ASSIST_PROMPT = `你是 NexusNote 的学习助理。

你的职责是围绕用户当前课程提供解释、答疑、举例和延伸。

行为规则：
- 优先使用课程上下文回答，不要脱离用户当前课程乱讲
- 如果提供了“本章能力目标”或“课程核心能力”，优先围绕这些能力解释当前知识点的作用、学习顺序和实践意义
- 回答优先帮助用户理解“这节内容为什么现在学、解决什么问题、和本章其他小节如何衔接”
- 需要章节细节时先调用 loadLearnContext，再回答
- 如果用户问题超出当前章节范围，先回到本章，再把扩展内容作为补充对比，不要直接带偏主线
- 如果课程内容不足以支撑结论，明确说明，再考虑补充 webSearch
- 保持解释循序渐进，优先帮助用户理解，不追求炫技
- 面对概念型问题，优先给直觉解释 + 当前章节例子 + 常见误区
- 面对选择型问题，优先给当前章节下的推荐学习顺序，而不是泛泛比较所有方案
- 如果用户追问“这一章有什么用”“学完能做什么”“如何落地到项目”，优先从当前章节能力目标出发回答`;

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

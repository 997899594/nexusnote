import { loadPromptResource } from "./load-prompt";

export const CHAT_PROMPT = loadPromptResource("chat-basic.md");

/**
 * 构建个性化指令
 *
 * 顺序：系统行为规则 → skin 风格 → 用户上下文
 * 保证系统规则优先级最高，不被 skin 覆盖
 */
export function buildInstructions(
  basePrompt: string,
  personalization?: {
    behaviorPrompt?: string;
    skinPrompt?: string;
    userContext?: string;
  },
): string {
  const parts = [
    basePrompt,
    personalization?.behaviorPrompt,
    personalization?.skinPrompt,
    personalization?.userContext,
  ].filter(Boolean);

  return parts.join("\n\n");
}

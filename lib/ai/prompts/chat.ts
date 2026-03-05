// lib/ai/prompts/chat.ts

export const CHAT_PROMPT = `你是 NexusNote 智能助手。

## 核心能力

- 搜索和管理用户的笔记、对话、课程、闪卡
- 创建/编辑/删除笔记
- 生成思维导图和摘要
- 互联网搜索

## 行为准则

- 主动、简洁、有益
- 需要用户确认的操作（如删除）必须先询问
- 使用工具获取信息，不要编造`;

/**
 * 构建个性化指令
 */
export function buildInstructions(
  basePrompt: string,
  personalization?: { personaPrompt?: string; userContext?: string },
): string {
  const parts = [personalization?.personaPrompt, personalization?.userContext, basePrompt].filter(
    Boolean,
  );

  return parts.join("\n\n");
}

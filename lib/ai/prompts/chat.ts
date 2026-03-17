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
- 使用工具获取信息，不要编造
- 回答问题前，优先使用 hybridSearch 在用户知识库中搜索相关内容
- 如果提供了当前学习上下文，优先参考上下文回答，必要时再搜索知识库补充`;

/**
 * 构建个性化指令
 *
 * 顺序：系统行为规则 → persona 风格 → 用户上下文
 * 保证系统规则优先级最高，不被 persona 覆盖
 */
export function buildInstructions(
  basePrompt: string,
  personalization?: { personaPrompt?: string; userContext?: string },
): string {
  const parts = [basePrompt, personalization?.personaPrompt, personalization?.userContext].filter(
    Boolean,
  );

  return parts.join("\n\n");
}

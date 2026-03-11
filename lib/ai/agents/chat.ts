/**
 * CHAT Agent - 通用对话
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { aiProvider } from "../core";
import { createToolContext } from "../core/tool-context";
import { buildInstructions, CHAT_PROMPT } from "../prompts/chat";
import { buildAgentTools } from "../tools";

export interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  userId?: string;
}

/**
 * 创建 CHAT Agent
 */
export function createChatAgent(options?: PersonalizationOptions) {
  if (!options?.userId) {
    throw new Error("Chat agent requires userId");
  }

  // 正确顺序：系统行为规则在前，persona 风格在后
  const instructions = buildInstructions(CHAT_PROMPT, {
    personaPrompt: options.personaPrompt,
    userContext: options.userContext,
  });

  const ctx = createToolContext({ userId: options.userId });
  const chatTools = buildAgentTools("chat", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: aiProvider.chatModel,
    instructions,
    tools: chatTools,
    stopWhen: stepCountIs(20),
  });
}

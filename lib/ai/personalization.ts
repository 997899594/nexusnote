/**
 * Personalization Service
 *
 * 统一的个人化服务，合并 persona + user context
 */

import { buildChatContext } from "@/lib/memory/chat-context-builder";
import { getPersona, getUserPersonaPreference } from "./personas/service";

export interface PersonalizationResult {
  systemPrompt: string;
  userContext: string;
}

/**
 * 构建个人化提示
 *
 * @param userId - 用户 ID
 * @param options - 可选配置
 * @returns 个人化系统提示和用户上下文
 */
export async function buildPersonalization(
  userId: string,
  options?: {
    personaSlug?: string;
  },
): Promise<PersonalizationResult> {
  if (!userId || userId === "anonymous") {
    return { systemPrompt: "", userContext: "" };
  }

  const [persona, context] = await Promise.all([
    getExplicitOrDefaultPersona(userId, options?.personaSlug),
    buildChatContext(userId),
  ]);

  const systemPrompt = persona ? `${persona.systemPrompt}` : "";

  return {
    systemPrompt,
    userContext: context || "",
  };
}

/**
 * 获取显式指定的 persona 或用户默认 persona
 */
async function getExplicitOrDefaultPersona(userId: string, explicitPersonaSlug?: string) {
  if (explicitPersonaSlug) {
    return getPersona(explicitPersonaSlug);
  }
  const pref = await getUserPersonaPreference(userId);
  return getPersona(pref.defaultPersonaSlug);
}

/**
 * Personalization Service
 *
 * 统一的个人化服务，显式分离：
 * - behaviorPrompt: 结构化用户偏好
 * - skinPrompt: 表达皮肤
 * - userContext: 推断式上下文
 */

import { buildExplicitPreferencePolicy } from "@/lib/ai/policy/compile-preferences";
import { DEFAULT_AI_PREFERENCES, normalizeAIPreferences } from "@/lib/ai/preferences";
import { getSkin, getUserSkinPreference } from "@/lib/ai/skins";
import { buildChatContext } from "@/lib/memory/chat-context-builder";
import { getUserProfile } from "@/lib/profile";

export interface PersonalizationResult {
  behaviorPrompt: string;
  skinPrompt: string;
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
    skinSlug?: string;
  },
): Promise<PersonalizationResult> {
  if (!userId || userId === "anonymous") {
    return { behaviorPrompt: "", skinPrompt: "", userContext: "" };
  }

  const [skin, profile, context] = await Promise.all([
    getExplicitOrDefaultSkin(userId, options?.skinSlug),
    getUserProfile(userId),
    buildChatContext(userId),
  ]);

  return {
    behaviorPrompt: buildExplicitPreferencePolicy({
      aiPreferences: normalizeAIPreferences(profile?.aiPreferences ?? DEFAULT_AI_PREFERENCES),
      learningStyle:
        (profile?.learningStyle as {
          preferredFormat?: string;
          pace?: string;
        } | null) ?? undefined,
    }),
    skinPrompt: skin ? `${skin.systemPrompt}` : "",
    userContext: context || "",
  };
}

/**
 * 获取显式指定的 skin 或用户默认 skin
 */
async function getExplicitOrDefaultSkin(userId: string, explicitSkinSlug?: string) {
  if (explicitSkinSlug) {
    return getSkin(explicitSkinSlug);
  }
  const preference = await getUserSkinPreference(userId);
  return getSkin(preference.defaultSkinSlug);
}

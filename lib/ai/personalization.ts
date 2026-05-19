/**
 * Personalization Service
 *
 * 统一的个人化服务，显式分离：
 * - behaviorPrompt: 结构化用户偏好
 * - skinPrompt: 表达皮肤
 */

import {
  type AIPreferences,
  DEFAULT_AI_PREFERENCES,
  normalizeAIPreferences,
} from "@/lib/ai/preferences";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { getSkin, getUserSkinPreference } from "@/lib/ai/skins";
import { getUserProfile } from "@/lib/profile";

export interface PersonalizationResult {
  behaviorPrompt: string;
  skinPrompt: string;
  userContext: string;
}

const EXPLICIT_PREFERENCE_POLICY_TEMPLATE = "personalization/explicit-preference-policy.md";
const TONE_GUIDANCE = {
  direct: loadPromptResource("personalization/tone-direct.md"),
  gentle: loadPromptResource("personalization/tone-gentle.md"),
  balanced: loadPromptResource("personalization/tone-balanced.md"),
} as const;
const DEPTH_GUIDANCE = {
  concise: loadPromptResource("personalization/depth-concise.md"),
  detailed: loadPromptResource("personalization/depth-detailed.md"),
  medium: loadPromptResource("personalization/depth-medium.md"),
} as const;
const TEACHING_STYLE_GUIDANCE = {
  coach: loadPromptResource("personalization/teaching-style-coach.md"),
  socratic: loadPromptResource("personalization/teaching-style-socratic.md"),
  explain: loadPromptResource("personalization/teaching-style-explain.md"),
} as const;
const RESPONSE_FORMAT_GUIDANCE = {
  structured: loadPromptResource("personalization/response-format-structured.md"),
  conversational: loadPromptResource("personalization/response-format-conversational.md"),
  adaptive: loadPromptResource("personalization/response-format-adaptive.md"),
} as const;

function buildExplicitPreferencePolicy(params: {
  aiPreferences: AIPreferences;
  learningStyle?: {
    preferredFormat?: string;
    pace?: string;
  } | null;
}): string {
  return renderPromptResource(EXPLICIT_PREFERENCE_POLICY_TEMPLATE, {
    tone_guidance:
      params.aiPreferences.tone === "direct"
        ? TONE_GUIDANCE.direct
        : params.aiPreferences.tone === "gentle"
          ? TONE_GUIDANCE.gentle
          : TONE_GUIDANCE.balanced,
    depth_guidance:
      params.aiPreferences.depth === "concise"
        ? DEPTH_GUIDANCE.concise
        : params.aiPreferences.depth === "detailed"
          ? DEPTH_GUIDANCE.detailed
          : DEPTH_GUIDANCE.medium,
    teaching_style_guidance:
      params.aiPreferences.teachingStyle === "coach"
        ? TEACHING_STYLE_GUIDANCE.coach
        : params.aiPreferences.teachingStyle === "socratic"
          ? TEACHING_STYLE_GUIDANCE.socratic
          : TEACHING_STYLE_GUIDANCE.explain,
    response_format_guidance:
      params.aiPreferences.responseFormat === "structured"
        ? RESPONSE_FORMAT_GUIDANCE.structured
        : params.aiPreferences.responseFormat === "conversational"
          ? RESPONSE_FORMAT_GUIDANCE.conversational
          : RESPONSE_FORMAT_GUIDANCE.adaptive,
    preferred_format_guidance: params.learningStyle?.preferredFormat
      ? renderPromptResource("personalization/preferred-learning-format.md", {
          preferred_learning_format: params.learningStyle.preferredFormat,
        })
      : "",
    pace_guidance: params.learningStyle?.pace
      ? renderPromptResource("personalization/preferred-learning-pace.md", {
          preferred_learning_pace: params.learningStyle.pace,
        })
      : "",
  });
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

  const [skin, profile] = await Promise.all([
    getExplicitOrDefaultSkin(userId, options?.skinSlug),
    getUserProfile(userId),
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
    userContext: "",
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

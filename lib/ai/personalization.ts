/**
 * Personalization Service
 *
 * 统一的个人化服务，显式分离：
 * - behaviorPrompt: 结构化用户偏好
 * - skinPrompt: 表达皮肤
 * - userContext: 推断式上下文
 */

import {
  type AIPreferences,
  DEFAULT_AI_PREFERENCES,
  normalizeAIPreferences,
} from "@/lib/ai/preferences";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { getSkin, getUserSkinPreference } from "@/lib/ai/skins";
import { getUserProfile } from "@/lib/profile";
import type { EMAValue } from "@/types/profile";

export interface PersonalizationResult {
  behaviorPrompt: string;
  skinPrompt: string;
  userContext: string;
}

const STYLE_ADAPTATION_TEMPLATE = "personalization/style-adaptation.md";
const EXPLICIT_PREFERENCE_POLICY_TEMPLATE = "personalization/explicit-preference-policy.md";
const STYLE_INSTRUCTIONS = {
  vocabularyAdvanced: loadPromptResource("personalization/style/vocabulary-advanced.md"),
  vocabularySimple: loadPromptResource("personalization/style/vocabulary-simple.md"),
  sentenceComplex: loadPromptResource("personalization/style/sentence-complex.md"),
  sentenceSimple: loadPromptResource("personalization/style/sentence-simple.md"),
  abstractionAbstract: loadPromptResource("personalization/style/abstraction-abstract.md"),
  abstractionConcrete: loadPromptResource("personalization/style/abstraction-concrete.md"),
  directnessDirect: loadPromptResource("personalization/style/directness-direct.md"),
  directnessGentle: loadPromptResource("personalization/style/directness-gentle.md"),
  concisenessConcise: loadPromptResource("personalization/style/conciseness-concise.md"),
  concisenessDetailed: loadPromptResource("personalization/style/conciseness-detailed.md"),
  formalityFormal: loadPromptResource("personalization/style/formality-formal.md"),
  formalityCasual: loadPromptResource("personalization/style/formality-casual.md"),
  emotionalMatch: loadPromptResource("personalization/style/emotional-match.md"),
  emotionalNeutral: loadPromptResource("personalization/style/emotional-neutral.md"),
} as const;
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

function appendStyleInstruction(
  instructions: string[],
  metric: EMAValue,
  highInstruction: string,
  lowInstruction: string,
) {
  if (metric.value > 0.7) {
    instructions.push(highInstruction);
    return;
  }

  if (metric.value < 0.3) {
    instructions.push(lowInstruction);
  }
}

function buildUserContextFromProfile(
  profile: Awaited<ReturnType<typeof getUserProfile>>,
): string | null {
  if (!profile || (profile.vocabularyComplexity?.samples ?? 0) < 3) {
    return null;
  }

  const vocab = profile.vocabularyComplexity as EMAValue;
  const sentence = profile.sentenceComplexity as EMAValue;
  const abstraction = profile.abstractionLevel as EMAValue;
  const directness = profile.directness as EMAValue;
  const conciseness = profile.conciseness as EMAValue;
  const formality = profile.formality as EMAValue;
  const emotional = profile.emotionalIntensity as EMAValue;

  const styleInstructions: string[] = [];
  appendStyleInstruction(
    styleInstructions,
    vocab,
    STYLE_INSTRUCTIONS.vocabularyAdvanced,
    STYLE_INSTRUCTIONS.vocabularySimple,
  );
  appendStyleInstruction(
    styleInstructions,
    sentence,
    STYLE_INSTRUCTIONS.sentenceComplex,
    STYLE_INSTRUCTIONS.sentenceSimple,
  );
  appendStyleInstruction(
    styleInstructions,
    abstraction,
    STYLE_INSTRUCTIONS.abstractionAbstract,
    STYLE_INSTRUCTIONS.abstractionConcrete,
  );
  appendStyleInstruction(
    styleInstructions,
    directness,
    STYLE_INSTRUCTIONS.directnessDirect,
    STYLE_INSTRUCTIONS.directnessGentle,
  );
  appendStyleInstruction(
    styleInstructions,
    conciseness,
    STYLE_INSTRUCTIONS.concisenessConcise,
    STYLE_INSTRUCTIONS.concisenessDetailed,
  );
  appendStyleInstruction(
    styleInstructions,
    formality,
    STYLE_INSTRUCTIONS.formalityFormal,
    STYLE_INSTRUCTIONS.formalityCasual,
  );
  appendStyleInstruction(
    styleInstructions,
    emotional,
    STYLE_INSTRUCTIONS.emotionalMatch,
    STYLE_INSTRUCTIONS.emotionalNeutral,
  );

  if (styleInstructions.length === 0) {
    return null;
  }

  const confidenceValues = [
    vocab.confidence,
    sentence.confidence,
    abstraction.confidence,
    directness.confidence,
    conciseness.confidence,
    formality.confidence,
    emotional.confidence,
  ];
  const avgConfidence =
    confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;

  return renderPromptResource(STYLE_ADAPTATION_TEMPLATE, {
    analyzed_message_count: vocab.samples,
    confidence_percent: (avgConfidence * 100).toFixed(0),
    style_instructions: styleInstructions.join("\n"),
  });
}

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
  const userContext = buildUserContextFromProfile(profile);

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
    userContext: userContext ?? "",
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

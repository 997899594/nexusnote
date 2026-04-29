/**
 * Style Analysis Service
 *
 * Analyzes user conversation style and updates user style profiles using EMA algorithm.
 * This service coordinates between the database layer and AI analysis.
 */

import { generateText, Output, type UIMessage } from "ai";
import { z } from "zod";
import { db, eq, userProfiles } from "@/db";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { loadConversationMessages } from "@/lib/chat/conversation-messages";
import { getOwnedConversation } from "@/lib/chat/conversation-repository";
import { getUserProfile } from "@/lib/profile";
import type { EMAValue } from "@/types/profile";

const DEFAULT_EMA_ALPHA = 0.3;

function updateEMA(
  current: { value: number; confidence: number; samples: number; lastAnalyzedAt?: string },
  newValue: number,
  alpha: number = DEFAULT_EMA_ALPHA,
): EMAValue {
  const clampedValue = Math.max(0, Math.min(1, newValue));
  const newSamples = current.samples + 1;
  const newEMA = alpha * clampedValue + (1 - alpha) * current.value;
  const newConfidence = Math.min(0.95, current.confidence + (1 - current.confidence) * 0.1);

  return {
    value: Math.max(0, Math.min(1, newEMA)),
    confidence: newConfidence,
    samples: newSamples,
    lastAnalyzedAt: new Date().toISOString(),
  };
}

// ============================================
// Type Definitions
// ============================================

/**
 * Raw style metrics from AI analysis
 */
export interface StyleMetrics {
  // Language complexity (0-1)
  vocabularyComplexity: number;
  sentenceComplexity: number;
  abstractionLevel: number;

  // Communication style (0-1)
  directness: number;
  conciseness: number;
  formality: number;
  emotionalIntensity: number;
}

/**
 * Big Five personality traits (optional, requires user consent)
 */
export interface BigFiveTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

/**
 * Complete style analysis result
 */
export interface StyleAnalysisResult {
  metrics: StyleMetrics;
  bigFive?: BigFiveTraits;
  confidence: number;
  reasoning?: string;
}

/**
 * User style profile for public API
 */
export interface UserStyleProfile {
  userId: string;
  metrics: {
    vocabularyComplexity: EMAValue;
    sentenceComplexity: EMAValue;
    abstractionLevel: EMAValue;
    directness: EMAValue;
    conciseness: EMAValue;
    formality: EMAValue;
    emotionalIntensity: EMAValue;
  };
  bigFive?: {
    openness: EMAValue;
    conscientiousness: EMAValue;
    extraversion: EMAValue;
    agreeableness: EMAValue;
    neuroticism: EMAValue;
  };
  totalMessagesAnalyzed: number;
  totalConversationsAnalyzed: number;
  lastAnalyzedAt: Date | null;
}

// ============================================
// Zod Schemas for AI Output
// ============================================

const StyleMetricsSchema = z.object({
  vocabularyComplexity: z
    .number()
    .min(0)
    .max(1)
    .describe("Richness and variety of vocabulary used (0=basic, 1=advanced)"),
  sentenceComplexity: z
    .number()
    .min(0)
    .max(1)
    .describe("Syntactic complexity of sentence structures (0=simple, 1=complex)"),
  abstractionLevel: z
    .number()
    .min(0)
    .max(1)
    .describe("Level of abstract vs concrete thinking (0=concrete, 1=abstract)"),
  directness: z
    .number()
    .min(0)
    .max(1)
    .describe("Communication directness (0=indirect/circumlocutory, 1=straightforward)"),
  conciseness: z.number().min(0).max(1).describe("Brevity of expression (0=verbose, 1=concise)"),
  formality: z.number().min(0).max(1).describe("Register of speech (0=casual, 1=formal)"),
  emotionalIntensity: z
    .number()
    .min(0)
    .max(1)
    .describe("Emotional expression level (0=neutral, 1=intense)"),
});

const BigFiveSchema = z.object({
  openness: z
    .number()
    .min(0)
    .max(1)
    .describe("Openness to experience: creativity, curiosity, preference for variety"),
  conscientiousness: z
    .number()
    .min(0)
    .max(1)
    .describe("Conscientiousness: organization, diligence, discipline"),
  extraversion: z
    .number()
    .min(0)
    .max(1)
    .describe("Extraversion: sociability, assertiveness, energy level"),
  agreeableness: z
    .number()
    .min(0)
    .max(1)
    .describe("Agreeableness: compassion, cooperativeness, trust"),
  neuroticism: z
    .number()
    .min(0)
    .max(1)
    .describe("Neuroticism: emotional stability, anxiety, mood variability"),
});

const StyleAnalysisSchema = z.object({
  metrics: StyleMetricsSchema,
  bigFive: BigFiveSchema.optional(),
  confidence: z.number().min(0).max(1).describe("Overall confidence in the analysis"),
  reasoning: z.string().optional().describe("Brief explanation of the analysis"),
});

// ============================================
// Style Analysis Functions
// ============================================

/**
 * Analyze conversation style using AI
 *
 * Extracts user messages from the conversation and analyzes their writing style.
 *
 * @param messages - Conversation messages (may include both user and assistant)
 * @param includeBigFive - Whether to analyze Big Five traits (requires user consent)
 * @returns Style analysis result
 */
export async function analyzeConversationStyle(
  messages: UIMessage[],
  includeBigFive: boolean = false,
): Promise<StyleAnalysisResult> {
  // Extract only user messages
  const userMessages = messages.filter((m) => m.role === "user");

  if (userMessages.length === 0) {
    throw new Error("No user messages to analyze");
  }

  // Combine user message content for analysis
  const conversationText = userMessages
    .map((message) => extractUIMessageText(message))
    .filter((text) => text.length > 0)
    .join("\n\n---\n\n");

  if (conversationText.trim().length < 20) {
    throw new Error("Insufficient text content for style analysis");
  }

  const systemPrompt = renderPromptResource("style-analysis-system.md", {
    big_five_policy: includeBigFive
      ? "Also analyze the Big Five personality traits based on language patterns. Note that this is for user personalization and the user has consented to this analysis."
      : "Do NOT include Big Five analysis unless explicitly requested.",
  });

  const userPrompt = renderPromptResource("style-analysis-user.md", {
    conversation_text: conversationText,
    big_five_guidance: includeBigFive
      ? `For Big Five traits, analyze language patterns that correlate with:
- Openness: metaphor use, creative expression, topic diversity
- Conscientiousness: structure, planning language, detail orientation
- Extraversion: assertiveness, social language, energy
- Agreeableness: cooperative vs competitive language, empathy indicators
- Neuroticism: anxiety words, emotional variability, certainty markers`
      : "Exclude Big Five analysis.",
  });

  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "style:analysis",
    intent: "style-analysis",
    modelPolicy: "quality-review",
    promptVersion: "style-analysis@v1",
    metadata: {
      messageCount: messages.length,
      includeBigFive,
    },
  });

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("quality-review"),
      output: Output.object({ schema: StyleAnalysisSchema }),
      prompt: userPrompt,
      system: systemPrompt,
      ...buildGenerationSettingsForPolicy("quality-review", {
        temperature: 0,
      }),
    });

    await recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return {
      metrics: result.output.metrics,
      bigFive: result.output.bigFive,
      confidence: result.output.confidence,
      reasoning: result.output.reasoning,
    };
  } catch (error) {
    console.error("[StyleAnalysis] AI analysis failed:", error);
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw new Error(
      `Style analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Update user style profile with EMA
 *
 * Analyzes a conversation and updates the user's style profile using
 * exponential moving average for smooth transitions.
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID to analyze
 * @param includeBigFive - Whether to analyze Big Five traits
 * @throws Error if conversation not found or access denied
 */
export async function updateUserStyleProfile(
  userId: string,
  conversationId: string,
  includeBigFive: boolean = false,
): Promise<void> {
  const conversation = await getOwnedConversation(conversationId, userId);
  if (!conversation) {
    throw new Error(`Conversation not found or not accessible: ${conversationId}`);
  }

  // Fetch current user profile
  const profile = await getUserProfile(userId);

  if (!profile) {
    throw new Error(`User profile not found for user: ${userId}`);
  }

  // Analyze conversation style
  const messages = await loadConversationMessages(conversationId);
  const analysis = await analyzeConversationStyle(messages, includeBigFive);

  // Build update object using EMA for smooth updates
  const updates: Record<string, EMAValue | number | Date> = {
    vocabularyComplexity: updateEMA(
      profile.vocabularyComplexity as EMAValue,
      analysis.metrics.vocabularyComplexity,
    ),
    sentenceComplexity: updateEMA(
      profile.sentenceComplexity as EMAValue,
      analysis.metrics.sentenceComplexity,
    ),
    abstractionLevel: updateEMA(
      profile.abstractionLevel as EMAValue,
      analysis.metrics.abstractionLevel,
    ),
    directness: updateEMA(profile.directness as EMAValue, analysis.metrics.directness),
    conciseness: updateEMA(profile.conciseness as EMAValue, analysis.metrics.conciseness),
    formality: updateEMA(profile.formality as EMAValue, analysis.metrics.formality),
    emotionalIntensity: updateEMA(
      profile.emotionalIntensity as EMAValue,
      analysis.metrics.emotionalIntensity,
    ),
    totalMessagesAnalyzed: (profile.totalMessagesAnalyzed || 0) + 1,
    totalConversationsAnalyzed: (profile.totalConversationsAnalyzed || 0) + 1,
    lastAnalyzedAt: new Date(),
    updatedAt: new Date(),
  };

  // Update Big Five if included
  if (includeBigFive && analysis.bigFive) {
    updates.openness = updateEMA(profile.openness as EMAValue, analysis.bigFive.openness);
    updates.conscientiousness = updateEMA(
      profile.conscientiousness as EMAValue,
      analysis.bigFive.conscientiousness,
    );
    updates.extraversion = updateEMA(
      profile.extraversion as EMAValue,
      analysis.bigFive.extraversion,
    );
    updates.agreeableness = updateEMA(
      profile.agreeableness as EMAValue,
      analysis.bigFive.agreeableness,
    );
    updates.neuroticism = updateEMA(profile.neuroticism as EMAValue, analysis.bigFive.neuroticism);
  }

  // Update database
  await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, userId));

  console.log(
    `[StyleAnalysis] Updated profile for user ${userId}, conversation ${conversationId}, confidence: ${analysis.confidence}`,
  );
}

/**
 * Get user style profile
 *
 * Returns the user's current style profile with all EMA values.
 *
 * @param userId - User ID
 * @returns User style profile or null if not found
 */
export async function getUserStyleProfile(userId: string): Promise<UserStyleProfile | null> {
  const profile = await getUserProfile(userId);

  if (!profile) {
    return null;
  }

  return {
    userId: profile.userId,
    metrics: {
      vocabularyComplexity: profile.vocabularyComplexity as EMAValue,
      sentenceComplexity: profile.sentenceComplexity as EMAValue,
      abstractionLevel: profile.abstractionLevel as EMAValue,
      directness: profile.directness as EMAValue,
      conciseness: profile.conciseness as EMAValue,
      formality: profile.formality as EMAValue,
      emotionalIntensity: profile.emotionalIntensity as EMAValue,
    },
    bigFive:
      profile.openness &&
      profile.conscientiousness &&
      profile.extraversion &&
      profile.agreeableness &&
      profile.neuroticism
        ? {
            openness: profile.openness as EMAValue,
            conscientiousness: profile.conscientiousness as EMAValue,
            extraversion: profile.extraversion as EMAValue,
            agreeableness: profile.agreeableness as EMAValue,
            neuroticism: profile.neuroticism as EMAValue,
          }
        : undefined,
    totalMessagesAnalyzed: profile.totalMessagesAnalyzed || 0,
    totalConversationsAnalyzed: profile.totalConversationsAnalyzed || 0,
    lastAnalyzedAt: profile.lastAnalyzedAt,
  };
}

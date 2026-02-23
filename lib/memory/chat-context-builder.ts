/**
 * Chat Context Builder
 *
 * Builds user context from user profiles for injection into AI chat system prompts.
 * Converts style metrics into actionable AI instructions.
 */

import { eq } from "drizzle-orm";
import { db, userProfiles } from "@/db";
import type { EMAValue } from "@/lib/profile";

// ============================================
// Types
// ============================================

export interface ChatContext {
  // Learning preferences (manual)
  learningStyle?: {
    preferredFormat?: string;
    pace?: string;
  };
  // Style analysis (AI-inferred)
  style?: {
    vocabularyLevel: "basic" | "intermediate" | "advanced";
    sentenceComplexity: "simple" | "moderate" | "complex";
    abstractionLevel: "concrete" | "balanced" | "abstract";
    directness: "indirect" | "balanced" | "direct";
    conciseness: "verbose" | "balanced" | "concise";
    formality: "casual" | "neutral" | "formal";
    emotionalTone: "neutral" | "expressive";
  };
  // Metadata
  confidence: number;
  samples: number;
}

// ============================================
// Context Builder
// ============================================

/**
 * Build chat context for a user
 *
 * Reads user profile and converts style metrics into AI-readable instructions.
 */
export async function buildChatContext(userId: string): Promise<string | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return null;
  }

  const parts: string[] = [];
  const styleInstructions: string[] = [];

  // ========== Learning Style (Manual) ==========
  const learningStyle = profile.learningStyle as {
    preferredFormat?: string;
    pace?: string;
  } | null;

  if (learningStyle) {
    if (learningStyle.preferredFormat) {
      parts.push(`Preferred learning format: ${learningStyle.preferredFormat}`);
    }
    if (learningStyle.pace) {
      parts.push(`Learning pace: ${learningStyle.pace}`);
    }
  }

  // ========== Style Analysis (AI-inferred) ==========

  // Only include style instructions if we have enough data
  const minSamples = 3;
  const hasStyleData =
    profile.vocabularyComplexity && profile.vocabularyComplexity.samples >= minSamples;

  if (!hasStyleData) {
    return parts.length > 0 ? parts.join("\n") : null;
  }

  const vocab = profile.vocabularyComplexity as EMAValue;
  const sentence = profile.sentenceComplexity as EMAValue;
  const abstraction = profile.abstractionLevel as EMAValue;
  const directness = profile.directness as EMAValue;
  const conciseness = profile.conciseness as EMAValue;
  const formality = profile.formality as EMAValue;
  const emotional = profile.emotionalIntensity as EMAValue;

  // Calculate average confidence
  const confidences = [vocab, sentence, abstraction, directness, conciseness, formality, emotional]
    .filter((v) => v)
    .map((v) => v.confidence);
  const avgConfidence =
    confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;

  // Vocabulary complexity
  if (vocab.value > 0.7) {
    styleInstructions.push("- Use advanced vocabulary and technical terms freely");
  } else if (vocab.value < 0.3) {
    styleInstructions.push("- Use simple, everyday language; avoid jargon");
  }

  // Sentence complexity
  if (sentence.value > 0.7) {
    styleInstructions.push("- User can handle complex sentence structures and nested ideas");
  } else if (sentence.value < 0.3) {
    styleInstructions.push("- Keep sentences simple and straightforward; break down complex ideas");
  }

  // Abstraction level
  if (abstraction.value > 0.7) {
    styleInstructions.push("- User comfortable with abstract concepts and theoretical discussions");
  } else if (abstraction.value < 0.3) {
    styleInstructions.push("- Use concrete examples; avoid overly abstract explanations");
  }

  // Directness
  if (directness.value > 0.7) {
    styleInstructions.push("- Be direct and straightforward; get to the point");
  } else if (directness.value < 0.3) {
    styleInstructions.push("- Use gentler, more indirect communication; ease into topics");
  }

  // Conciseness
  if (conciseness.value > 0.7) {
    styleInstructions.push("- Keep responses concise; prioritize key information");
  } else if (conciseness.value < 0.3) {
    styleInstructions.push("- Provide detailed explanations; thorough is better than brief");
  }

  // Formality
  if (formality.value > 0.7) {
    styleInstructions.push("- Maintain formal, professional tone");
  } else if (formality.value < 0.3) {
    styleInstructions.push("- Use casual, conversational tone; informal language is fine");
  }

  // Emotional intensity
  if (emotional.value > 0.7) {
    styleInstructions.push("- Match user's expressive, emotional communication style");
  } else if (emotional.value < 0.3) {
    styleInstructions.push("- Keep responses neutral and objective");
  }

  if (styleInstructions.length > 0) {
    parts.push("\n=== Communication Style Adaptation ===");
    parts.push(
      `(Based on ${vocab.samples} messages analyzed, confidence: ${(avgConfidence * 100).toFixed(0)}%)`,
    );
    parts.push(...styleInstructions);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Build a simplified context object (for UI display)
 */
export async function buildChatContextObject(userId: string): Promise<ChatContext | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return null;
  }

  const vocab = profile.vocabularyComplexity as EMAValue | null;
  const sentence = profile.sentenceComplexity as EMAValue | null;
  const abstraction = profile.abstractionLevel as EMAValue | null;
  const directness = profile.directness as EMAValue | null;
  const conciseness = profile.conciseness as EMAValue | null;
  const formality = profile.formality as EMAValue | null;
  const emotional = profile.emotionalIntensity as EMAValue | null;

  // Calculate average confidence
  const values = [
    vocab,
    sentence,
    abstraction,
    directness,
    conciseness,
    formality,
    emotional,
  ].filter((v) => v !== null) as EMAValue[];
  const avgConfidence =
    values.length > 0 ? values.reduce((sum, v) => sum + v.confidence, 0) / values.length : 0;
  const samples = vocab?.samples || 0;

  return {
    learningStyle: profile.learningStyle as
      | {
          preferredFormat?: string;
          pace?: string;
        }
      | undefined,
    style:
      vocab && vocab.samples >= 3
        ? {
            vocabularyLevel:
              vocab.value > 0.7 ? "advanced" : vocab.value < 0.3 ? "basic" : "intermediate",
            sentenceComplexity:
              sentence?.value && sentence.value > 0.7
                ? "complex"
                : sentence?.value && sentence.value < 0.3
                  ? "simple"
                  : "moderate",
            abstractionLevel:
              abstraction?.value && abstraction.value > 0.7
                ? "abstract"
                : abstraction?.value && abstraction.value < 0.3
                  ? "concrete"
                  : "balanced",
            directness:
              directness?.value && directness.value > 0.7
                ? "direct"
                : directness?.value && directness.value < 0.3
                  ? "indirect"
                  : "balanced",
            conciseness:
              conciseness?.value && conciseness.value > 0.7
                ? "concise"
                : conciseness?.value && conciseness.value < 0.3
                  ? "verbose"
                  : "balanced",
            formality:
              formality?.value && formality.value > 0.7
                ? "formal"
                : formality?.value && formality.value < 0.3
                  ? "casual"
                  : "neutral",
            emotionalTone: emotional?.value && emotional.value > 0.7 ? "expressive" : "neutral",
          }
        : undefined,
    confidence: avgConfidence,
    samples,
  };
}

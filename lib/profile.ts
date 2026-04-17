/**
 * Services Layer - Profile Service
 *
 * Business logic layer for user profile management.
 * Coordinates between the API layer and data access layer.
 */

import { db, eq, userProfiles } from "@/db";
import { type AIPreferences, DEFAULT_AI_PREFERENCES } from "@/lib/ai/preferences";
import type { EMAValue } from "@/types/profile";

export type { EMAValue } from "@/types/profile";

/**
 * Learning style preferences (user-set, not AI-inferred)
 */
export interface LearningStyle {
  preferredFormat?: string;
  pace?: string;
}

/**
 * Input for creating a new user profile
 */
export interface CreateProfileInput {
  userId: string;
  learningStyle?: LearningStyle;
  aiPreferences?: AIPreferences;
}

/**
 * Input for updating an existing user profile
 */
export interface UpdateProfileInput {
  learningStyle?: LearningStyle;
  aiPreferences?: AIPreferences;
}

export function createDefaultEMAValue(): EMAValue {
  return {
    value: 0.5,
    confidence: 0,
    samples: 0,
    lastAnalyzedAt: "",
  };
}

export function buildDefaultProfileAnalysisFields() {
  return {
    vocabularyComplexity: createDefaultEMAValue(),
    sentenceComplexity: createDefaultEMAValue(),
    abstractionLevel: createDefaultEMAValue(),
    directness: createDefaultEMAValue(),
    conciseness: createDefaultEMAValue(),
    formality: createDefaultEMAValue(),
    emotionalIntensity: createDefaultEMAValue(),
    openness: createDefaultEMAValue(),
    conscientiousness: createDefaultEMAValue(),
    extraversion: createDefaultEMAValue(),
    agreeableness: createDefaultEMAValue(),
    neuroticism: createDefaultEMAValue(),
    totalMessagesAnalyzed: 0,
    totalConversationsAnalyzed: 0,
  };
}

export async function getUserProfile(userId: string) {
  return db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });
}

/**
 * Get or create a user profile
 * @param userId - The user's ID
 * @returns The user's profile, creating one if it doesn't exist
 */
export async function getOrCreate(userId: string) {
  // Try to get existing profile
  const existing = await getUserProfile(userId);

  if (existing) {
    return existing;
  }

  const [newProfile] = await db
    .insert(userProfiles)
    .values({
      userId,
      learningStyle: { preferredFormat: "mixed", pace: "moderate" },
      aiPreferences: DEFAULT_AI_PREFERENCES,
      ...buildDefaultProfileAnalysisFields(),
    })
    .returning();

  return newProfile;
}

/**
 * Update a user's profile
 * @param userId - The user's ID
 * @param input - Profile updates
 * @returns The updated profile
 * @throws Error if no profile found for the user
 */
export async function update(userId: string, input: UpdateProfileInput) {
  const [updated] = await db
    .update(userProfiles)
    .set({
      ...(input.learningStyle && { learningStyle: input.learningStyle }),
      ...(input.aiPreferences && { aiPreferences: input.aiPreferences }),
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (!updated) {
    throw new Error(`Profile not found for user: ${userId}`);
  }

  return updated;
}

/**
 * Delete a user's profile
 * @param userId - The user's ID
 */
export async function deleteProfile(userId: string): Promise<void> {
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}

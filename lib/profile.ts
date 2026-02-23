/**
 * Services Layer - Profile Service
 *
 * Business logic layer for user profile management.
 * Coordinates between the API layer and data access layer.
 */

import { db, eq, userProfiles } from "@/db";

/**
 * EMA (Exponential Moving Average) value structure
 * Used for style analysis metrics
 */
export interface EMAValue {
  value: number; // Current value (0-1)
  confidence: number; // Confidence level (0-1)
  samples: number; // Number of samples analyzed
}

/**
 * Learning style preferences (user-set, not AI-inferred)
 */
export interface LearningStyle {
  preferredFormat: string;
  pace: string;
}

/**
 * Input for creating a new user profile
 */
export interface CreateProfileInput {
  userId: string;
  learningStyle?: LearningStyle;
}

/**
 * Input for updating an existing user profile
 */
export interface UpdateProfileInput {
  learningStyle?: LearningStyle;
}

/**
 * Get or create a user profile
 * @param userId - The user's ID
 * @returns The user's profile, creating one if it doesn't exist
 */
export async function getOrCreate(userId: string) {
  // Try to get existing profile
  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (existing) {
    return existing;
  }

  // Create new profile with new schema structure (EMA fields for style analysis)
  console.log(`[ProfileService] Creating new profile for user: ${userId}`);
  const [newProfile] = await db
    .insert(userProfiles)
    .values({
      userId,
      learningStyle: { preferredFormat: "mixed", pace: "moderate" },
      vocabularyComplexity: { value: 0.5, confidence: 0, samples: 0 },
      sentenceComplexity: { value: 0.5, confidence: 0, samples: 0 },
      abstractionLevel: { value: 0.5, confidence: 0, samples: 0 },
      directness: { value: 0.5, confidence: 0, samples: 0 },
      conciseness: { value: 0.5, confidence: 0, samples: 0 },
      formality: { value: 0.5, confidence: 0, samples: 0 },
      emotionalIntensity: { value: 0.5, confidence: 0, samples: 0 },
      openness: { value: 0.5, confidence: 0, samples: 0 },
      conscientiousness: { value: 0.5, confidence: 0, samples: 0 },
      extraversion: { value: 0.5, confidence: 0, samples: 0 },
      agreeableness: { value: 0.5, confidence: 0, samples: 0 },
      neuroticism: { value: 0.5, confidence: 0, samples: 0 },
      totalMessagesAnalyzed: 0,
      totalConversationsAnalyzed: 0,
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
  console.log(`[ProfileService] Updating profile for user: ${userId}`, input);

  const [updated] = await db
    .update(userProfiles)
    .set({
      ...(input.learningStyle && { learningStyle: input.learningStyle }),
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
  console.log(`[ProfileService] Deleting profile for user: ${userId}`);
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}

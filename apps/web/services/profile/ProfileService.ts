/**
 * Services Layer - Profile Service
 *
 * Business logic layer for user learning profile management.
 * Coordinates between the API layer and data access layer.
 */

import { db, userProfiles, eq } from "@/db";
import { aiProvider } from "@/infrastructure/ai/provider";
import { embedMany } from "ai";

/**
 * Learning goals with priorities
 */
export interface LearningGoals {
  goals: string[];
  priority: string[];
}

/**
 * Knowledge areas with proficiency levels
 */
export interface KnowledgeAreas {
  areas: string[];
  proficiency: Record<string, string>;
}

/**
 * Learning style preferences
 */
export interface LearningStyle {
  preferredFormat: string;
  pace: string;
}

/**
 * Assessment history
 */
export interface AssessmentHistory {
  scores: number[];
  timestamps: string[];
  topics: string[];
}

/**
 * Current proficiency level
 */
export type CurrentLevel = "beginner" | "intermediate" | "advanced";

/**
 * Input for creating a new user profile
 */
export interface CreateProfileInput {
  userId: string;
  learningGoals?: LearningGoals;
  knowledgeAreas?: KnowledgeAreas;
  learningStyle?: LearningStyle;
  assessmentHistory?: AssessmentHistory;
  currentLevel?: CurrentLevel;
  totalStudyMinutes?: number;
}

/**
 * Input for updating an existing user profile
 */
export interface UpdateProfileInput {
  learningGoals?: LearningGoals;
  knowledgeAreas?: KnowledgeAreas;
  learningStyle?: LearningStyle;
  assessmentHistory?: AssessmentHistory;
  currentLevel?: CurrentLevel;
  totalStudyMinutes?: number;
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

  // Create new profile with proper schema structure
  console.log(`[ProfileService] Creating new profile for user: ${userId}`);
  const [newProfile] = await db
    .insert(userProfiles)
    .values({
      userId,
      learningGoals: { goals: [], priority: [] },
      knowledgeAreas: { areas: [], proficiency: {} },
      learningStyle: { preferredFormat: "mixed", pace: "moderate" },
      assessmentHistory: { scores: [], timestamps: [], topics: [] },
      currentLevel: "beginner",
      totalStudyMinutes: 0,
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
      ...(input.learningGoals && { learningGoals: input.learningGoals }),
      ...(input.knowledgeAreas && { knowledgeAreas: input.knowledgeAreas }),
      ...(input.learningStyle && { learningStyle: input.learningStyle }),
      ...(input.assessmentHistory && { assessmentHistory: input.assessmentHistory }),
      ...(input.currentLevel && { currentLevel: input.currentLevel }),
      ...(input.totalStudyMinutes !== undefined && { totalStudyMinutes: input.totalStudyMinutes }),
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
 * Get a user's profile as a formatted text chunk for RAG
 * @param userId - The user's ID
 * @returns Formatted profile text for embedding, or null if no profile
 */
export async function getProfileChunk(userId: string): Promise<string | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return null;
  }

  const parts: string[] = [];

  const learningGoals = profile.learningGoals as LearningGoals | null;
  const knowledgeAreas = profile.knowledgeAreas as KnowledgeAreas | null;
  const learningStyle = profile.learningStyle as LearningStyle | null;
  const assessmentHistory = profile.assessmentHistory as AssessmentHistory | null;

  if (learningGoals?.goals?.length) {
    const goals = learningGoals.goals.join(", ");
    parts.push(`Learning Goals: ${goals}`);
  }

  if (knowledgeAreas?.areas?.length) {
    const areas = knowledgeAreas.areas.join(", ");
    parts.push(`Knowledge Areas: ${areas}`);
  }

  if (profile.currentLevel) {
    parts.push(`Current Level: ${profile.currentLevel}`);
  }

  if (learningStyle) {
    const style = JSON.stringify(learningStyle);
    parts.push(`Learning Style: ${style}`);
  }

  if (assessmentHistory?.scores?.length) {
    const avgScore =
      assessmentHistory.scores.reduce((a: number, b: number) => a + b, 0) /
      assessmentHistory.scores.length;
    parts.push(`Average Assessment Score: ${avgScore.toFixed(1)}`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Generate and update profile embedding for personalized RAG
 * @param userId - The user's ID
 */
export async function generateProfileEmbedding(userId: string): Promise<void> {
  console.log(`[ProfileService] Generating profile embedding for user: ${userId}`);

  // Check if AI provider is configured
  if (!aiProvider.isConfigured()) {
    console.warn("[ProfileService] AI Provider not configured, skipping embedding");
    return;
  }

  const chunk = await getProfileChunk(userId);

  if (!chunk) {
    console.warn(`[ProfileService] No profile data found for embedding: ${userId}`);
    return;
  }

  const { embeddings } = await embedMany({
    model: aiProvider.embeddingModel,
    values: [chunk],
  });

  const [embedding] = embeddings;

  await db
    .update(userProfiles)
    .set({
      profileEmbedding: embedding,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  console.log(`[ProfileService] Successfully updated embedding for user: ${userId}`);
}

/**
 * Update profile embedding after profile changes
 * @param userId - The user's ID
 */
export async function updateProfileEmbedding(userId: string): Promise<void> {
  console.log(`[ProfileService] Updating profile embedding for user: ${userId}`);
  await generateProfileEmbedding(userId);
}

/**
 * Delete a user's profile
 * @param userId - The user's ID
 */
export async function deleteProfile(userId: string): Promise<void> {
  console.log(`[ProfileService] Deleting profile for user: ${userId}`);
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}

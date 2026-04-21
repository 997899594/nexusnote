/**
 * Privacy Settings Service
 *
 * Manages user privacy settings for style analysis, including:
 * - Analysis consent and enablement
 * - Big Five personality trait analysis consent
 * - Data retention policies
 * - Style data deletion
 */

import { db, eq, stylePrivacySettings, userProfiles } from "@/db";
import { buildDefaultProfileAnalysisFields } from "@/lib/profile";

// ============================================
// Type Definitions
// ============================================

/**
 * Privacy settings update input
 */
export interface PrivacySettingsInput {
  analysisEnabled?: boolean;
  bigFiveEnabled?: boolean;
  autoDeleteAfterDays?: number | null;
}

/**
 * Privacy settings response
 */
export interface PrivacySettings {
  analysisEnabled: boolean;
  bigFiveEnabled: boolean;
  autoDeleteAfterDays: number | null;
  consentGivenAt: Date | null;
  bigFiveConsentGivenAt: Date | null;
}

function toPrivacySettings(settings: typeof stylePrivacySettings.$inferSelect): PrivacySettings {
  return {
    analysisEnabled: settings.analysisEnabled,
    bigFiveEnabled: settings.bigFiveEnabled,
    autoDeleteAfterDays: settings.autoDeleteAfterDays,
    consentGivenAt: settings.consentGivenAt,
    bigFiveConsentGivenAt: settings.bigFiveConsentGivenAt,
  };
}

async function getPrivacySettingsRow(userId: string) {
  return db.query.stylePrivacySettings.findFirst({
    where: eq(stylePrivacySettings.userId, userId),
  });
}

// ============================================
// Privacy Settings Functions
// ============================================

/**
 * Get privacy settings for a user
 *
 * @param userId - User ID
 * @returns Privacy settings or null if not found
 */
export async function getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
  const settings = await getPrivacySettingsRow(userId);
  return settings ? toPrivacySettings(settings) : null;
}

/**
 * Update privacy settings for a user
 *
 * Creates new settings if they don't exist, otherwise updates existing settings.
 * Tracks consent timestamps when features are enabled.
 *
 * @param userId - User ID
 * @param settings - Settings to update
 * @returns Updated privacy settings
 */
export async function updatePrivacySettings(
  userId: string,
  input: PrivacySettingsInput,
): Promise<PrivacySettings> {
  const existing = await getPrivacySettingsRow(userId);

  const now = new Date();
  let result: typeof stylePrivacySettings.$inferSelect;

  if (existing) {
    // Update existing settings
    // Track consent timestamps when features are newly enabled
    const updates: Record<string, boolean | number | Date | null> = {
      updatedAt: now,
    };

    if (input.analysisEnabled !== undefined) {
      updates.analysisEnabled = input.analysisEnabled;
      // Set consent timestamp if enabling and not previously consented
      if (input.analysisEnabled && !existing.consentGivenAt) {
        updates.consentGivenAt = now;
      }
    }

    if (input.bigFiveEnabled !== undefined) {
      updates.bigFiveEnabled = input.bigFiveEnabled;
      // Set consent timestamp if enabling and not previously consented
      if (input.bigFiveEnabled && !existing.bigFiveConsentGivenAt) {
        updates.bigFiveConsentGivenAt = now;
      }
    }

    if (input.autoDeleteAfterDays !== undefined) {
      updates.autoDeleteAfterDays = input.autoDeleteAfterDays;
    }

    const [updated] = await db
      .update(stylePrivacySettings)
      .set(updates)
      .where(eq(stylePrivacySettings.userId, userId))
      .returning();

    result = updated;
  } else {
    // Create new settings
    const [created] = await db
      .insert(stylePrivacySettings)
      .values({
        userId,
        analysisEnabled: input.analysisEnabled ?? false,
        bigFiveEnabled: input.bigFiveEnabled ?? false,
        autoDeleteAfterDays: input.autoDeleteAfterDays,
        consentGivenAt: input.analysisEnabled ? now : null,
        bigFiveConsentGivenAt: input.bigFiveEnabled ? now : null,
      })
      .returning();

    result = created;
  }

  return toPrivacySettings(result);
}

/**
 * Delete all style analysis data for a user
 *
 * Resets all style metrics to default values and disables analysis.
 * Use this when a user withdraws consent or requests data deletion.
 *
 * @param userId - User ID
 */
export async function deleteStyleData(userId: string): Promise<void> {
  await db
    .update(userProfiles)
    .set({
      ...buildDefaultProfileAnalysisFields(),
      lastAnalyzedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  // Disable analysis and Big Five in privacy settings
  await updatePrivacySettings(userId, {
    analysisEnabled: false,
    bigFiveEnabled: false,
  });

  console.log(`[Privacy] Deleted style data for user ${userId}`);
}

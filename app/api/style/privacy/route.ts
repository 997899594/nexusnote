/**
 * GET/PUT/DELETE /api/style/privacy - Privacy Settings API
 *
 * Manage user privacy settings for style analysis:
 * - GET: Retrieve current privacy settings
 * - PUT: Update privacy settings
 * - DELETE: Delete all style data and disable analysis
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { deleteStyleData, getPrivacySettings, updatePrivacySettings } from "@/lib/style/privacy";

export const runtime = "nodejs";

// ============================================
// Validation Schema
// ============================================

const UpdatePrivacySettingsSchema = z.object({
  analysisEnabled: z.boolean().optional(),
  bigFiveEnabled: z.boolean().optional(),
  autoDeleteAfterDays: z.number().int().min(1).nullable().optional(),
});

// ============================================
// GET - Retrieve Privacy Settings
// ============================================

export const GET = withAuth(async (_request, { userId }) => {
  // Get privacy settings
  const settings = await getPrivacySettings(userId);

  // Return default values if no settings exist
  return Response.json({
    analysisEnabled: settings?.analysisEnabled ?? false,
    bigFiveEnabled: settings?.bigFiveEnabled ?? false,
    autoDeleteAfterDays: settings?.autoDeleteAfterDays ?? null,
    consentGivenAt: settings?.consentGivenAt ?? null,
    bigFiveConsentGivenAt: settings?.bigFiveConsentGivenAt ?? null,
  });
});

// ============================================
// PUT - Update Privacy Settings
// ============================================

export const PUT = withAuth(async (request, { userId }) => {
  // Parse and validate request body
  const body = await request.json();
  const input = UpdatePrivacySettingsSchema.parse(body);

  // Update privacy settings
  const settings = await updatePrivacySettings(userId, input);

  return Response.json(settings);
});

// ============================================
// DELETE - Delete Style Data
// ============================================

export const DELETE = withAuth(async (_request, { userId }) => {
  // Delete all style data and disable analysis
  await deleteStyleData(userId);

  return Response.json({
    success: true,
    message: "Style data deleted and analysis disabled",
  });
});

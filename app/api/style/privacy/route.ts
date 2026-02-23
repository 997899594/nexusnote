/**
 * GET/PUT/DELETE /api/style/privacy - Privacy Settings API
 *
 * Manage user privacy settings for style analysis:
 * - GET: Retrieve current privacy settings
 * - PUT: Update privacy settings
 * - DELETE: Delete all style data and disable analysis
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, APIError } from "@/lib/api";
import {
  getPrivacySettings,
  updatePrivacySettings,
  deleteStyleData,
} from "@/lib/style/privacy";
import { z } from "zod";

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

export async function GET() {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // Get privacy settings
    const settings = await getPrivacySettings(session.user.id);

    // Return default values if no settings exist
    return NextResponse.json({
      analysisEnabled: settings?.analysisEnabled ?? false,
      bigFiveEnabled: settings?.bigFiveEnabled ?? false,
      autoDeleteAfterDays: settings?.autoDeleteAfterDays ?? null,
      consentGivenAt: settings?.consentGivenAt ?? null,
      bigFiveConsentGivenAt: settings?.bigFiveConsentGivenAt ?? null,
    });
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// PUT - Update Privacy Settings
// ============================================

export async function PUT(request: Request) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // Parse and validate request body
    const body = await request.json();
    const input = UpdatePrivacySettingsSchema.parse(body);

    // Update privacy settings
    const settings = await updatePrivacySettings(session.user.id, input);

    return NextResponse.json(settings);
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// DELETE - Delete Style Data
// ============================================

export async function DELETE() {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // Delete all style data and disable analysis
    await deleteStyleData(session.user.id);

    return NextResponse.json({
      success: true,
      message: "Style data deleted and analysis disabled",
    });
  } catch (error) {
    return handleError(error);
  }
}

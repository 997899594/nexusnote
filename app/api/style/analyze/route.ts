/**
 * POST /api/style/analyze - Analyze user conversation style
 *
 * Analyzes a conversation and updates the user's style profile
 * using exponential moving average for smooth metric updates.
 */

import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { updateUserStyleProfile } from "@/lib/style/analysis";
import { AnalyzeStyleSchema } from "@/lib/style/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withAuth(async (request, { userId }) => {
  // Parse and validate request body
  const body = await request.json();
  const { conversationId, includeBigFive } = AnalyzeStyleSchema.parse(body);

  // Update user style profile
  await updateUserStyleProfile(userId, conversationId, includeBigFive);

  return Response.json({
    success: true,
    message: "Style analysis completed",
  });
});

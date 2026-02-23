/**
 * POST /api/style/analyze - Analyze user conversation style
 *
 * Analyzes a conversation and updates the user's style profile
 * using exponential moving average for smooth metric updates.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, APIError } from "@/lib/api";
import { AnalyzeStyleSchema } from "@/lib/style/validation";
import { updateUserStyleProfile } from "@/lib/style/analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    // Parse and validate request body
    const body = await request.json();
    const { conversationId, includeBigFive } = AnalyzeStyleSchema.parse(body);

    // Update user style profile
    await updateUserStyleProfile(session.user.id, conversationId, includeBigFive);

    return NextResponse.json({
      success: true,
      message: "Style analysis completed",
    });
  } catch (error) {
    return handleError(error);
  }
}

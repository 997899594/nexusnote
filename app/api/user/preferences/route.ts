/**
 * User Preferences API
 *
 * 主语义使用 AI preferences + skin。
 */

import { z } from "zod";
import { AIPreferencesSchema, DEFAULT_AI_PREFERENCES } from "@/lib/ai/preferences";
import {
  type AISkin,
  getAvailableSkins,
  getUserSkinPreference,
  type SkinPreference,
} from "@/lib/ai/skins";
import { withAuth } from "@/lib/api";
import { getOrCreate, update } from "@/lib/profile";
import { getUserStyleProfile, type UserStyleProfile } from "@/lib/style/analysis";

interface PreferencesResponse {
  profile: {
    learningStyle?: {
      preferredFormat?: string;
      pace?: string;
    };
    aiPreferences: {
      tone: "direct" | "balanced" | "gentle";
      depth: "concise" | "balanced" | "detailed";
      teachingStyle: "explain" | "coach" | "socratic";
      responseFormat: "structured" | "balanced" | "conversational";
    };
    style?: UserStyleProfile;
  };
  skinPreference: SkinPreference;
  availableSkins: AISkin[];
}

const UpdatePreferencesSchema = z.object({
  learningStyle: z
    .object({
      preferredFormat: z.enum(["text", "video", "mixed", "audio", "interactive"]).optional(),
      pace: z.enum(["slow", "moderate", "fast", "adaptive"]).optional(),
    })
    .optional(),
  aiPreferences: AIPreferencesSchema.optional(),
});

export const GET = withAuth(async (_request, { userId }) => {
  // Parallel fetch all AI preference data
  const [profile, styleProfile, skinPreference, availableSkins] = await Promise.all([
    getOrCreate(userId),
    getUserStyleProfile(userId),
    getUserSkinPreference(userId),
    getAvailableSkins(userId),
  ]);

  const response: PreferencesResponse = {
    profile: {
      learningStyle: (profile.learningStyle as {
        preferredFormat?: string;
        pace?: string;
      } | null) ?? {
        preferredFormat: "mixed",
        pace: "moderate",
      },
      aiPreferences: AIPreferencesSchema.parse(profile.aiPreferences ?? DEFAULT_AI_PREFERENCES),
      style: styleProfile || undefined,
    },
    skinPreference,
    availableSkins,
  };

  return Response.json(response);
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const input = UpdatePreferencesSchema.parse(body);

  const updated = await update(userId, {
    learningStyle: input.learningStyle,
    aiPreferences: input.aiPreferences,
  });

  return Response.json({
    success: true,
    profile: {
      learningStyle: updated.learningStyle,
      aiPreferences: AIPreferencesSchema.parse(updated.aiPreferences ?? DEFAULT_AI_PREFERENCES),
    },
  });
});

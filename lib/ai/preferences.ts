import { z } from "zod";
import {
  AIRouteProfileSchema,
  DEFAULT_AI_ROUTE_PROFILE,
  normalizeAIRouteProfile,
} from "@/lib/ai/core/route-profiles";

export const AIPreferencesSchema = z.object({
  routeProfile: AIRouteProfileSchema.default(DEFAULT_AI_ROUTE_PROFILE),
  tone: z.enum(["direct", "balanced", "gentle"]).default("balanced"),
  depth: z.enum(["concise", "balanced", "detailed"]).default("balanced"),
  teachingStyle: z.enum(["explain", "coach", "socratic"]).default("explain"),
  responseFormat: z.enum(["structured", "balanced", "conversational"]).default("balanced"),
});

export type AIPreferences = z.infer<typeof AIPreferencesSchema>;

export const DEFAULT_AI_PREFERENCES: AIPreferences = AIPreferencesSchema.parse({});

export function normalizeAIPreferences(input: unknown): AIPreferences {
  return AIPreferencesSchema.parse(input ?? {});
}

export function getAIRouteProfileFromPreferences(input: unknown) {
  return normalizeAIRouteProfile(normalizeAIPreferences(input).routeProfile);
}

import { z } from "zod";

export const AIPreferencesSchema = z.object({
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

import { z } from "zod";
import {
  AIModelSeriesSchema,
  DEFAULT_AI_MODEL_SERIES,
  normalizeAIModelSeries,
} from "@/lib/ai/core/model-series";

export const AIPreferencesSchema = z.object({
  modelSeries: AIModelSeriesSchema.default(DEFAULT_AI_MODEL_SERIES),
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

export function getAIModelSeriesFromPreferences(input: unknown) {
  return normalizeAIModelSeries(normalizeAIPreferences(input).modelSeries);
}

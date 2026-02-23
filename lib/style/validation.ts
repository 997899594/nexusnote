/**
 * Style Analysis API - Zod Validation Schemas
 */

import { z } from "zod";

/**
 * Schema for analyzing user conversation style
 */
export const AnalyzeStyleSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID format"),
  includeBigFive: z.boolean().optional().default(false).describe("Whether to analyze Big Five personality traits"),
});

export type AnalyzeStyleInput = z.infer<typeof AnalyzeStyleSchema>;

/**
 * Schema for updating user learning style preferences
 * These are manually set by the user, not AI-inferred
 */
export const UpdateStylePreferenceSchema = z.object({
  learningStyle: z
    .object({
      preferredFormat: z
        .enum(["text", "video", "mixed", "audio", "interactive"])
        .optional()
        .describe("Preferred learning content format"),
      pace: z
        .enum(["slow", "moderate", "fast", "adaptive"])
        .optional()
        .describe("Preferred learning pace"),
    })
    .optional()
    .describe("Learning style preferences"),
});

export type UpdateStylePreferenceInput = z.infer<typeof UpdateStylePreferenceSchema>;

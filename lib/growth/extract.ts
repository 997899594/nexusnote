import { generateText, Output } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  GROWTH_EXTRACT_AI_TIMEOUT_MS,
  GROWTH_EXTRACT_PROMPT_VERSION,
} from "@/lib/growth/constants";
import type { NormalizedGrowthOutline } from "@/lib/growth/normalize-outline";
import { buildGrowthExtractPrompt, GROWTH_EXTRACT_SYSTEM_PROMPT } from "@/lib/growth/prompts";

export const growthEvidenceKindSchema = z.enum(["skill", "theme", "tool", "workflow", "concept"]);

export const extractedGrowthEvidenceItemSchema = z.object({
  title: z.string().min(1),
  kind: growthEvidenceKindSchema,
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  chapterKeys: z.array(z.string()).default([]),
  prerequisiteHints: z.array(z.string()).default([]),
  relatedHints: z.array(z.string()).default([]),
  evidenceSnippets: z.array(z.string()).default([]),
});

export const growthCourseExtractorOutputSchema = z.object({
  items: z.array(extractedGrowthEvidenceItemSchema),
});

export type ExtractedGrowthEvidenceItem = z.infer<typeof extractedGrowthEvidenceItemSchema>;
export type GrowthCourseExtractorOutput = z.infer<typeof growthCourseExtractorOutputSchema>;

export interface GrowthCourseExtractionInput {
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  outline: NormalizedGrowthOutline;
}

export function buildGrowthExtractionIdempotencyKey(
  userId: string,
  courseId: string,
  outlineHash: string,
): string {
  return `extract:user:${userId}:course:${courseId}:outline:${outlineHash}:prompt:${GROWTH_EXTRACT_PROMPT_VERSION}`;
}

export function buildGrowthCourseExtractionInput(params: {
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  outline: NormalizedGrowthOutline;
}): GrowthCourseExtractionInput {
  return {
    userId: params.userId,
    courseId: params.courseId,
    title: params.title,
    description: params.description,
    outline: params.outline,
  };
}

export async function extractGrowthCourseEvidence(
  input: GrowthCourseExtractionInput,
): Promise<GrowthCourseExtractorOutput> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "growth:extract",
    intent: "growth-extract",
    workflow: "growth",
    modelPolicy: "extract-fast",
    promptVersion: GROWTH_EXTRACT_PROMPT_VERSION,
    userId: input.userId,
    metadata: {
      courseId: input.courseId,
      chapterCount: input.outline.chapters.length,
    },
  });

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("extract-fast"),
      output: Output.object({ schema: growthCourseExtractorOutputSchema }),
      system: GROWTH_EXTRACT_SYSTEM_PROMPT,
      prompt: buildGrowthExtractPrompt({
        title: input.title,
        description: input.description,
        outline: input.outline,
      }),
      ...buildGenerationSettingsForPolicy("extract-fast", {
        temperature: 0.1,
      }),
      timeout: GROWTH_EXTRACT_AI_TIMEOUT_MS,
    });

    await recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return result.output;
  } catch (error) {
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

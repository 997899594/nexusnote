import { generateText, Output } from "ai";
import { z } from "zod";
import {
  createTelemetryContext,
  getErrorMessage,
  getJsonModelForPolicy,
  recordAIUsage,
} from "@/lib/ai/core";
import type { NormalizedCareerOutline } from "@/lib/career-tree/normalize-outline";
import {
  buildCareerExtractPrompt,
  CAREER_TREE_EXTRACT_SYSTEM_PROMPT,
} from "@/lib/career-tree/prompts";

export const careerEvidenceKindSchema = z.enum(["skill", "theme", "tool", "workflow", "concept"]);

export const extractedCareerEvidenceItemSchema = z.object({
  title: z.string().min(1),
  kind: careerEvidenceKindSchema,
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  chapterKeys: z.array(z.string()).default([]),
  prerequisiteHints: z.array(z.string()).default([]),
  relatedHints: z.array(z.string()).default([]),
  evidenceSnippets: z.array(z.string()).default([]),
});

export const courseExtractorOutputSchema = z.object({
  items: z.array(extractedCareerEvidenceItemSchema),
});

export type ExtractedCareerEvidenceItem = z.infer<typeof extractedCareerEvidenceItemSchema>;
export type CourseExtractorOutput = z.infer<typeof courseExtractorOutputSchema>;

export interface CareerCourseExtractionInput {
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  outline: NormalizedCareerOutline;
}

export function buildCareerExtractionIdempotencyKey(
  userId: string,
  courseId: string,
  outlineHash: string,
): string {
  return `extract:user:${userId}:course:${courseId}:outline:${outlineHash}`;
}

export function buildCareerCourseExtractionInput(params: {
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  outline: NormalizedCareerOutline;
}): CareerCourseExtractionInput {
  return {
    userId: params.userId,
    courseId: params.courseId,
    title: params.title,
    description: params.description,
    outline: params.outline,
  };
}

export async function extractCareerCourseEvidence(
  input: CareerCourseExtractionInput,
): Promise<CourseExtractorOutput> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "career-tree:extract",
    intent: "career-tree-extract",
    workflow: "career-tree",
    modelPolicy: "structured-high-quality",
    promptVersion: "career-tree-extract@v1",
    userId: input.userId,
    metadata: {
      courseId: input.courseId,
      chapterCount: input.outline.chapters.length,
    },
  });

  try {
    const result = await generateText({
      model: getJsonModelForPolicy("structured-high-quality"),
      output: Output.object({ schema: courseExtractorOutputSchema }),
      system: CAREER_TREE_EXTRACT_SYSTEM_PROMPT,
      prompt: buildCareerExtractPrompt({
        title: input.title,
        description: input.description,
        outline: input.outline,
      }),
      temperature: 0.1,
      timeout: 30_000,
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

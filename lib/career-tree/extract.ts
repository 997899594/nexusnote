import { z } from "zod";
import type { NormalizedCareerOutline } from "@/lib/career-tree/normalize-outline";

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

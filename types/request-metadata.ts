/**
 * Request Metadata - Discriminated Union Types
 *
 * Type-safe metadata for runtime request contexts.
 */

import { z } from "zod";

export const LearnRequestMetadataSchema = z.object({
  context: z.literal("learn"),
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0).optional(),
  chapterSkillIds: z.array(z.string()).max(8).optional(),
});

export const EditorRequestMetadataSchema = z.object({
  context: z.literal("editor"),
  documentId: z.string().uuid(),
});

export const CareerRequestMetadataSchema = z.object({
  context: z.literal("career"),
  selectedDirectionKey: z.string().trim().min(1).optional(),
});

export const InterviewRequestMetadataSchema = z.object({
  context: z.literal("interview"),
  courseId: z.string().uuid().optional(),
});

export const DefaultRequestMetadataSchema = z
  .object({
    context: z.literal("default").optional(),
  })
  .passthrough();

export const RequestMetadataSchema = z.union([
  LearnRequestMetadataSchema,
  EditorRequestMetadataSchema,
  CareerRequestMetadataSchema,
  InterviewRequestMetadataSchema,
  DefaultRequestMetadataSchema,
]);

export type LearnRequestMetadata = z.infer<typeof LearnRequestMetadataSchema>;
export type EditorRequestMetadata = z.infer<typeof EditorRequestMetadataSchema>;
export type CareerRequestMetadata = z.infer<typeof CareerRequestMetadataSchema>;
export type InterviewRequestMetadata = z.infer<typeof InterviewRequestMetadataSchema>;
export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;

export function isLearnRequestMetadata(value: unknown): value is LearnRequestMetadata {
  return LearnRequestMetadataSchema.safeParse(value).success;
}

export function isEditorRequestMetadata(value: unknown): value is EditorRequestMetadata {
  return EditorRequestMetadataSchema.safeParse(value).success;
}

export function isCareerRequestMetadata(value: unknown): value is CareerRequestMetadata {
  return CareerRequestMetadataSchema.safeParse(value).success;
}

export function isInterviewRequestMetadata(value: unknown): value is InterviewRequestMetadata {
  return InterviewRequestMetadataSchema.safeParse(value).success;
}

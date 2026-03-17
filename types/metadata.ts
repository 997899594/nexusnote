/**
 * Chat Metadata - Discriminated Union Types
 *
 * Type-safe metadata for different chat contexts.
 * Uses Zod discriminated union for runtime validation.
 */

import { z } from "zod";

export const LearnMetadataSchema = z.object({
  context: z.literal("learn"),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  chapterIndex: z.number().int().min(0),
  chapterTitle: z.string(),
});

export const EditorMetadataSchema = z.object({
  context: z.literal("editor"),
  documentId: z.string().uuid(),
});

export const DefaultMetadataSchema = z
  .object({
    context: z.literal("default").optional(),
  })
  .passthrough();

export const ChatMetadataSchema = z.union([
  LearnMetadataSchema,
  EditorMetadataSchema,
  DefaultMetadataSchema,
]);

export type LearnMetadata = z.infer<typeof LearnMetadataSchema>;
export type EditorMetadata = z.infer<typeof EditorMetadataSchema>;
export type ChatMetadata = z.infer<typeof ChatMetadataSchema>;

export function isLearnMetadata(m: unknown): m is LearnMetadata {
  return LearnMetadataSchema.safeParse(m).success;
}

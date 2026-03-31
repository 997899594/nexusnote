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
  chapterIndex: z.number().int().min(0),
  chapterSkillIds: z.array(z.string()).max(8).optional(),
});

export const ResolvedLearnMetadataSchema = z.object({
  context: z.literal("learn"),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  chapterIndex: z.number().int().min(0),
  chapterTitle: z.string(),
  courseSkillIds: z.array(z.string()).max(12).optional(),
  chapterSkillIds: z.array(z.string()).max(8).optional(),
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

export const ResolvedChatMetadataSchema = z.union([
  ResolvedLearnMetadataSchema,
  EditorMetadataSchema,
  DefaultMetadataSchema,
]);

export type LearnMetadata = z.infer<typeof LearnMetadataSchema>;
export type ResolvedLearnMetadata = z.infer<typeof ResolvedLearnMetadataSchema>;
export type EditorMetadata = z.infer<typeof EditorMetadataSchema>;
export type ChatMetadata = z.infer<typeof ChatMetadataSchema>;
export type ResolvedChatMetadata = z.infer<typeof ResolvedChatMetadataSchema>;

export function isLearnMetadata(m: unknown): m is LearnMetadata {
  return LearnMetadataSchema.safeParse(m).success;
}

export function isResolvedLearnMetadata(m: unknown): m is ResolvedLearnMetadata {
  return ResolvedLearnMetadataSchema.safeParse(m).success;
}

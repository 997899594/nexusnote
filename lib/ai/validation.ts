/**
 * AI Validation - 2026 Modern Zod Validation
 */

import { z } from "zod";
import { defaults } from "@/config/env";
import { InterviewOutlineSchema } from "@/lib/ai/interview/schemas";
import { RequestMetadataSchema } from "@/types/request-metadata";

const BaseConversationRequestSchema = z
  .object({
    messages: z.array(z.unknown()).min(1).max(defaults.conversationInput.maxMessages),
    sessionId: z.string().uuid().optional(),
  })
  .strict();

export const LearnSelectionContextSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0),
  chapterTitle: z.string().trim().max(200).optional(),
  sectionTitle: z.string().trim().max(200).optional(),
});

export const ChatApiRequestSchema = BaseConversationRequestSchema.extend({
  intent: z.literal("CHAT").optional(),
  skinSlug: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .min(1)
    .optional(),
  courseId: z.string().uuid().nullish(), // 允许 null 或 undefined
  metadata: RequestMetadataSchema.optional(),
  learnSelectionContext: LearnSelectionContextSchema.optional(),
});

export const InterviewApiRequestSchema = BaseConversationRequestSchema.extend({
  courseId: z.string().uuid().nullish(),
  outline: InterviewOutlineSchema.nullish(),
});

export type ChatApiRequest = z.infer<typeof ChatApiRequestSchema>;
export type InterviewApiRequest = z.infer<typeof InterviewApiRequestSchema>;

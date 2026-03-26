/**
 * AI Validation - 2026 Modern Zod Validation
 */

import { z } from "zod";
import { InterviewOutlineSchema } from "@/lib/ai/interview";
import { ChatMetadataSchema } from "@/types/metadata";

const BaseConversationRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  sessionId: z.string().optional(),
});

export const ChatApiRequestSchema = BaseConversationRequestSchema.extend({
  intent: z.literal("CHAT").optional(),
  personaSlug: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .min(1)
    .optional(),
  courseId: z.string().uuid().nullish(), // 允许 null 或 undefined
  metadata: ChatMetadataSchema.optional(),
});

export const InterviewApiRequestSchema = BaseConversationRequestSchema.extend({
  messages: z.array(z.unknown()).min(1),
  courseId: z.string().uuid().nullish(),
  outline: InterviewOutlineSchema.nullish(),
});

export type ChatApiRequest = z.infer<typeof ChatApiRequestSchema>;
export type InterviewApiRequest = z.infer<typeof InterviewApiRequestSchema>;

/**
 * AI Validation - 2026 Modern Zod Validation
 */

import { z } from "zod";
import { ChatMetadataSchema } from "@/types/metadata";

export const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  intent: z.enum(["CHAT", "INTERVIEW", "EDITOR", "SEARCH", "SKILLS"]).optional(),
  sessionId: z.string().optional(),
  personaSlug: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .min(1)
    .optional(),
  courseId: z.string().uuid().nullish(), // 允许 null 或 undefined
  metadata: ChatMetadataSchema.optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type Intent = ChatRequest["intent"];

export function validateRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}

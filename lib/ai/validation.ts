/**
 * AI Validation - 2026 Modern Zod Validation
 */

import { z } from "zod";

export const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  intent: z.enum(["CHAT", "INTERVIEW", "COURSE", "EDITOR", "SEARCH", "SKILLS", "STYLE"]).optional(),
  sessionId: z.string().optional(),
  personaSlug: z
    .string()
    .regex(/^[a-z0-9_-]+$/)
    .min(1)
    .optional(),
  courseId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type Intent = ChatRequest["intent"];

export function validateRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}

/**
 * AI Validation - 2026 Modern Zod Validation
 */

import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]).default("user"),
  content: z.union([z.string(), z.array(z.unknown())]).default(""),
});

export const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  intent: z.enum(["CHAT", "INTERVIEW", "COURSE", "EDITOR", "SEARCH"]).default("CHAT"),
  sessionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type Intent = ChatRequest["intent"];

export function sanitizeInput(input: string): string {
  // Remove control characters using character class escape
  return input
    .replace(/[\p{Cc}]/gu, "")
    .slice(0, 50000)
    .trim();
}

export function validateRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}

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
  // Remove control characters (ASCII 0-31, 127)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control chars
  const controlChars = /[\x00-\x1F\x7F]/g;
  return input.replace(controlChars, "").slice(0, 50000).trim();
}

export function validateRequest(data: unknown) {
  return ChatRequestSchema.safeParse(data);
}

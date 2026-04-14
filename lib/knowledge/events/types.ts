import { z } from "zod";

export const evidenceEventKindSchema = z.enum([
  "course_outline",
  "course_progress",
  "highlight",
  "note",
  "conversation",
  "capture",
  "user_preference",
]);

export type EvidenceEventKind = z.infer<typeof evidenceEventKindSchema>;

export const evidenceEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: evidenceEventKindSchema,
  sourceType: z.string(),
  sourceId: z.string().nullable(),
  sourceVersionHash: z.string().nullable(),
  title: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  happenedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type EvidenceEvent = z.infer<typeof evidenceEventSchema>;

export const evidenceEventRefSchema = z.object({
  eventId: z.string(),
  refType: z.string(),
  refId: z.string(),
  snippet: z.string().nullable().optional(),
  weight: z.number().min(0).default(1),
});

export type EvidenceEventRef = z.infer<typeof evidenceEventRefSchema>;

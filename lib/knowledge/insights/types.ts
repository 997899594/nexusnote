import { z } from "zod";

export const knowledgeInsightKindSchema = z.enum([
  "theme",
  "gap",
  "strength",
  "trajectory",
  "recommendation_reason",
]);

export type KnowledgeInsightKind = z.infer<typeof knowledgeInsightKindSchema>;

export const knowledgeInsightSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: knowledgeInsightKindSchema,
  title: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type KnowledgeInsight = z.infer<typeof knowledgeInsightSchema>;

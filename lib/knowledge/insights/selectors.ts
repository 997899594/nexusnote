import { desc, eq } from "drizzle-orm";
import { db, knowledgeInsightEvidence, knowledgeInsights } from "@/db";
import { knowledgeInsightSchema } from "./types";

export async function listUserKnowledgeInsights(userId: string) {
  const rows = await db
    .select({
      id: knowledgeInsights.id,
      kind: knowledgeInsights.kind,
      title: knowledgeInsights.title,
      summary: knowledgeInsights.summary,
      confidence: knowledgeInsights.confidence,
    })
    .from(knowledgeInsights)
    .where(eq(knowledgeInsights.userId, userId))
    .orderBy(desc(knowledgeInsights.confidence), desc(knowledgeInsights.updatedAt));

  return rows.map((row) =>
    knowledgeInsightSchema.parse({
      id: row.id,
      userId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      confidence: Number(row.confidence),
      metadata: {},
    }),
  );
}

export async function listInsightEvidenceLinks(insightId: string) {
  return db
    .select({
      evidenceId: knowledgeInsightEvidence.evidenceId,
      weight: knowledgeInsightEvidence.weight,
    })
    .from(knowledgeInsightEvidence)
    .where(eq(knowledgeInsightEvidence.insightId, insightId));
}

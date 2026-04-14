import { db, knowledgeInsightEvidence, knowledgeInsights } from "@/db";
import type { KnowledgeInsight } from "./types";

export interface IngestKnowledgeInsightInput extends KnowledgeInsight {
  evidenceIds?: string[];
}

export async function ingestKnowledgeInsight(input: IngestKnowledgeInsightInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [insight] = await tx
      .insert(knowledgeInsights)
      .values({
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        confidence: input.confidence.toFixed(3),
      })
      .returning({ id: knowledgeInsights.id });

    if (input.evidenceIds && input.evidenceIds.length > 0) {
      await tx.insert(knowledgeInsightEvidence).values(
        input.evidenceIds.map((evidenceId) => ({
          insightId: insight.id,
          evidenceId,
          weight: "1.000",
        })),
      );
    }

    return insight.id;
  });
}

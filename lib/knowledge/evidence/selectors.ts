import { and, eq } from "drizzle-orm";
import { db, knowledgeEvidence, knowledgeEvidenceSourceLinks } from "@/db";

export async function listCourseKnowledgeEvidence(params: {
  userId: string;
  courseId: string;
  sourceVersionHash: string;
}) {
  return db
    .select({
      id: knowledgeEvidence.id,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      refType: knowledgeEvidenceSourceLinks.refType,
      refId: knowledgeEvidenceSourceLinks.refId,
      snippet: knowledgeEvidenceSourceLinks.snippet,
      weight: knowledgeEvidenceSourceLinks.weight,
    })
    .from(knowledgeEvidence)
    .leftJoin(
      knowledgeEvidenceSourceLinks,
      eq(knowledgeEvidenceSourceLinks.evidenceId, knowledgeEvidence.id),
    )
    .where(
      and(
        eq(knowledgeEvidence.userId, params.userId),
        eq(knowledgeEvidence.sourceType, "course"),
        eq(knowledgeEvidence.sourceId, params.courseId),
        eq(knowledgeEvidence.sourceVersionHash, params.sourceVersionHash),
      ),
    );
}

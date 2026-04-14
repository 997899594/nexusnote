import { and, eq, isNull } from "drizzle-orm";
import {
  careerUserSkillNodeEvidence,
  db,
  knowledgeEvidence,
  knowledgeEvidenceSourceLinks,
} from "@/db";

function buildSourceVersionCondition(
  sourceVersionHash: string | null | undefined,
  field: typeof knowledgeEvidence.sourceVersionHash,
) {
  if (sourceVersionHash === undefined) {
    return undefined;
  }

  return sourceVersionHash === null ? isNull(field) : eq(field, sourceVersionHash);
}

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

export async function listLinkedNodeIdsForEvidenceSource(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}) {
  const rows = await db
    .select({
      nodeId: careerUserSkillNodeEvidence.nodeId,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      knowledgeEvidence,
      eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
    )
    .where(
      and(
        eq(careerUserSkillNodeEvidence.userId, params.userId),
        eq(knowledgeEvidence.sourceType, params.sourceType),
        eq(knowledgeEvidence.sourceId, params.sourceId),
        buildSourceVersionCondition(params.sourceVersionHash, knowledgeEvidence.sourceVersionHash),
      ),
    );

  return [...new Set(rows.map((row) => row.nodeId))];
}

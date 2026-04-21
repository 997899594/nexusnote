import { and, eq } from "drizzle-orm";
import { db, knowledgeEvidence, userSkillNodeEvidence } from "@/db";
import { buildSourceVersionCondition } from "@/lib/growth/source-version";

type EvidenceSelectorDb = Pick<typeof db, "select">;

export async function listLinkedNodeIdsForEvidenceSource(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}) {
  const rows = await listLinkedNodeEvidenceRows(params);

  return [...new Set(rows.map((row) => row.nodeId))];
}

export async function listLinkedNodeEvidenceRows(params: {
  executor?: EvidenceSelectorDb;
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}) {
  const executor = params.executor ?? db;

  return executor
    .select({
      id: userSkillNodeEvidence.id,
      nodeId: userSkillNodeEvidence.nodeId,
      evidenceId: userSkillNodeEvidence.knowledgeEvidenceId,
    })
    .from(userSkillNodeEvidence)
    .innerJoin(
      knowledgeEvidence,
      eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
    )
    .where(
      and(
        eq(userSkillNodeEvidence.userId, params.userId),
        eq(knowledgeEvidence.sourceType, params.sourceType),
        eq(knowledgeEvidence.sourceId, params.sourceId),
        buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, params.sourceVersionHash),
      ),
    );
}

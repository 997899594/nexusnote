import { and, eq, inArray, like } from "drizzle-orm";
import {
  db,
  knowledgeEvidence,
  knowledgeGenerationRuns,
  userSkillEdges,
  userSkillNodeEvidence,
  userSkillNodes,
} from "@/db";
import { recomputeNodeAggregates } from "@/lib/growth/aggregation";
import type { EvidenceMergeRow } from "@/lib/growth/data-access";
import { bumpGrowthGraphState } from "@/lib/growth/graph-state";
import {
  type MergePlannerEvidenceBatchItem,
  planDeterministicGrowthMerge,
  validateMergePlannerOutput,
} from "@/lib/growth/merge";
import { retrieveMergeCandidateSet } from "@/lib/growth/retrieve-merge-candidates";
import type { EvidenceSourceLinkRow } from "@/lib/knowledge/evidence/source-links";

type GrowthTransaction = Pick<typeof db, "delete" | "insert" | "query" | "select" | "update">;
type GrowthReadExecutor = Pick<typeof db, "select">;

type ValidatedGrowthMerge = ReturnType<typeof validateMergePlannerOutput>;

function buildMergePlannerEvidenceBatch(
  evidenceRows: EvidenceMergeRow[],
  evidenceRefs: EvidenceSourceLinkRow[],
): MergePlannerEvidenceBatchItem[] {
  return evidenceRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    confidence: Number(row.confidence),
    chapterKeys: evidenceRefs
      .filter((ref) => ref.evidenceId === row.id && ref.refType === "chapter")
      .map((ref) => ref.refId),
    evidenceSnippets: evidenceRefs
      .filter((ref) => ref.evidenceId === row.id && ref.snippet)
      .map((ref) => ref.snippet!)
      .filter(Boolean),
  }));
}

export async function planValidatedGrowthMerge(params: {
  userId: string;
  evidenceRows: EvidenceMergeRow[];
  evidenceRefs: EvidenceSourceLinkRow[];
}): Promise<ValidatedGrowthMerge> {
  const [existingNodes, existingEvidenceLinks, existingPrerequisiteEdges] = await Promise.all([
    db
      .select({
        id: userSkillNodes.id,
        canonicalLabel: userSkillNodes.canonicalLabel,
        summary: userSkillNodes.summary,
      })
      .from(userSkillNodes)
      .where(eq(userSkillNodes.userId, params.userId)),
    db
      .select({
        nodeId: userSkillNodeEvidence.nodeId,
        title: knowledgeEvidence.title,
        summary: knowledgeEvidence.summary,
      })
      .from(userSkillNodeEvidence)
      .innerJoin(
        knowledgeEvidence,
        eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
      )
      .where(eq(userSkillNodeEvidence.userId, params.userId)),
    db
      .select({
        fromNodeId: userSkillEdges.fromNodeId,
        toNodeId: userSkillEdges.toNodeId,
      })
      .from(userSkillEdges)
      .where(eq(userSkillEdges.userId, params.userId)),
  ]);

  const evidenceBatch = buildMergePlannerEvidenceBatch(params.evidenceRows, params.evidenceRefs);

  const candidateSet = retrieveMergeCandidateSet({
    evidenceItems: evidenceBatch.map((item) => ({
      id: item.id,
      title: item.title,
      kind: "skill",
      summary: item.summary,
      confidence: item.confidence,
      chapterKeys: item.chapterKeys,
      prerequisiteHints: [],
      relatedHints: [],
      evidenceSnippets: item.evidenceSnippets,
    })),
    existingNodes,
    existingEvidenceLinks,
    existingPrerequisiteEdges,
  });

  const planned = planDeterministicGrowthMerge({
    candidateContext: candidateSet,
    evidenceBatch,
  });

  return validateMergePlannerOutput({
    output: planned,
    allowedTargetNodeIds: new Set(existingNodes.map((node) => node.id)),
    allowedEvidenceIds: new Set(params.evidenceRows.map((row) => row.id)),
  });
}

export async function applyValidatedGrowthMerge(params: {
  tx: GrowthTransaction;
  userId: string;
  mergeRunId: string;
  validated: ValidatedGrowthMerge;
  staleNodeEvidenceRows: Array<{ id: string; nodeId: string }>;
  affectedNodeIds?: string[];
  priorEdgeRunIds?: string[];
  applyPrerequisiteEdges?: boolean;
}) {
  if (params.staleNodeEvidenceRows.length > 0) {
    await params.tx.delete(userSkillNodeEvidence).where(
      inArray(
        userSkillNodeEvidence.id,
        params.staleNodeEvidenceRows.map((row) => row.id),
      ),
    );
  }

  const priorEdgeRunIds = params.priorEdgeRunIds ?? [];
  if (priorEdgeRunIds.length > 0) {
    await params.tx
      .delete(userSkillEdges)
      .where(inArray(userSkillEdges.sourceMergeRunId, priorEdgeRunIds));
  }

  const tempNodeRefMap = new Map<string, string>();
  const touchedNodeIds = new Set([
    ...params.staleNodeEvidenceRows.map((row) => row.nodeId),
    ...(params.affectedNodeIds ?? []),
  ]);

  for (const decision of params.validated.decisions) {
    if (decision.action === "attach") {
      touchedNodeIds.add(decision.targetNodeId);
      await params.tx
        .insert(userSkillNodeEvidence)
        .values(
          decision.evidenceIds.map((evidenceId) => ({
            userId: params.userId,
            nodeId: decision.targetNodeId,
            knowledgeEvidenceId: evidenceId,
            mergeRunId: params.mergeRunId,
            weight: decision.confidence.toFixed(3),
          })),
        )
        .onConflictDoNothing();
      continue;
    }

    const [createdNode] = await params.tx
      .insert(userSkillNodes)
      .values({
        userId: params.userId,
        canonicalLabel: decision.newNode.canonicalLabel,
        summary: decision.newNode.summary ?? null,
        state: "ready",
        progress: 0,
        masteryScore: 0,
        evidenceScore: 0,
        courseCount: 0,
        chapterCount: 0,
        lastMergedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: userSkillNodes.id });

    tempNodeRefMap.set(decision.tempNodeRef, createdNode.id);
    touchedNodeIds.add(createdNode.id);

    await params.tx.insert(userSkillNodeEvidence).values(
      decision.evidenceIds.map((evidenceId) => ({
        userId: params.userId,
        nodeId: createdNode.id,
        knowledgeEvidenceId: evidenceId,
        mergeRunId: params.mergeRunId,
        weight: decision.confidence.toFixed(3),
      })),
    );
  }

  if (params.applyPrerequisiteEdges !== false) {
    const resolvedEdges = params.validated.prerequisiteEdges
      .map((edge) => ({
        fromNodeId: tempNodeRefMap.get(edge.from) ?? edge.from,
        toNodeId: tempNodeRefMap.get(edge.to) ?? edge.to,
        confidence: edge.confidence.toFixed(3),
      }))
      .filter((edge) => edge.fromNodeId !== edge.toNodeId);

    if (resolvedEdges.length > 0) {
      await params.tx
        .insert(userSkillEdges)
        .values(
          resolvedEdges.map((edge) => ({
            userId: params.userId,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            confidence: edge.confidence,
            sourceMergeRunId: params.mergeRunId,
          })),
        )
        .onConflictDoNothing();

      for (const edge of resolvedEdges) {
        touchedNodeIds.add(edge.fromNodeId);
        touchedNodeIds.add(edge.toNodeId);
      }
    }
  }

  await bumpGrowthGraphState(params.tx, {
    userId: params.userId,
    lastMergeRunId: params.mergeRunId,
  });

  await recomputeNodeAggregates(params.tx, params.userId, [...touchedNodeIds]);
}

export async function listSourceMergeRunIds(params: {
  executor?: GrowthReadExecutor;
  userId: string;
  sourceType: string;
  sourceId: string;
}): Promise<string[]> {
  const executor = params.executor ?? db;

  const rows = await executor
    .select({ id: knowledgeGenerationRuns.id })
    .from(knowledgeGenerationRuns)
    .where(
      and(
        eq(knowledgeGenerationRuns.userId, params.userId),
        eq(knowledgeGenerationRuns.kind, "merge"),
        like(
          knowledgeGenerationRuns.idempotencyKey,
          `merge:user:${params.userId}:source:${params.sourceType}:${params.sourceId}:hash:%`,
        ),
      ),
    );

  return rows.map((row) => row.id);
}

export async function listCourseMergeRunIds(params: {
  executor?: GrowthReadExecutor;
  userId: string;
  courseId: string;
}): Promise<string[]> {
  const executor = params.executor ?? db;

  const rows = await executor
    .select({ id: knowledgeGenerationRuns.id })
    .from(knowledgeGenerationRuns)
    .where(
      and(
        eq(knowledgeGenerationRuns.userId, params.userId),
        eq(knowledgeGenerationRuns.courseId, params.courseId),
        eq(knowledgeGenerationRuns.kind, "merge"),
      ),
    );

  return rows.map((row) => row.id);
}

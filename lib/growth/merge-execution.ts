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
import type { EvidenceMergeRow, EvidenceRefRow } from "@/lib/growth/data-access";
import { bumpGrowthGraphState } from "@/lib/growth/graph-state";
import { planGrowthGraphMerge, validateMergePlannerOutput } from "@/lib/growth/merge";
import { retrieveMergeCandidateSet } from "@/lib/growth/retrieve-merge-candidates";

type GrowthTransaction = Pick<typeof db, "delete" | "insert" | "query" | "select" | "update">;

type ValidatedGrowthMerge = ReturnType<typeof validateMergePlannerOutput>;

function normalizeBootstrapLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBootstrapGrowthMerge(evidenceRows: EvidenceMergeRow[]): ValidatedGrowthMerge {
  const groupedDecisions = new Map<
    string,
    {
      tempNodeRef: string;
      canonicalLabel: string;
      summary: string | null;
      confidence: number;
      evidenceIds: string[];
    }
  >();

  for (const [index, row] of evidenceRows.entries()) {
    const normalizedLabel = normalizeBootstrapLabel(row.title);
    const decisionKey = normalizedLabel || `evidence-${index + 1}`;
    const existing = groupedDecisions.get(decisionKey);

    if (existing) {
      existing.evidenceIds.push(row.id);
      if (!existing.summary && row.summary) {
        existing.summary = row.summary;
      }
      existing.confidence = Math.max(existing.confidence, Number(row.confidence));
      continue;
    }

    groupedDecisions.set(decisionKey, {
      tempNodeRef: `bootstrap-${index + 1}`,
      canonicalLabel: row.title.trim() || `能力 ${index + 1}`,
      summary: row.summary?.trim() || null,
      confidence: Number(row.confidence),
      evidenceIds: [row.id],
    });
  }

  return validateMergePlannerOutput({
    output: {
      decisions: [...groupedDecisions.values()].map((decision) => ({
        action: "create" as const,
        tempNodeRef: decision.tempNodeRef,
        newNode: {
          canonicalLabel: decision.canonicalLabel,
          summary: decision.summary,
        },
        evidenceIds: decision.evidenceIds,
        confidence: decision.confidence,
        reason: "Bootstrap user skill graph from new evidence with no attach candidates.",
      })),
      prerequisiteEdges: [],
    },
    allowedTargetNodeIds: new Set<string>(),
    allowedEvidenceIds: new Set(evidenceRows.map((row) => row.id)),
  });
}

export async function planValidatedGrowthMerge(params: {
  userId: string;
  plannerResourceId: string;
  evidenceRows: EvidenceMergeRow[];
  evidenceRefs: EvidenceRefRow[];
  priorSummary: unknown;
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

  const candidateSet = retrieveMergeCandidateSet({
    evidenceItems: params.evidenceRows.map((row) => ({
      title: row.title,
      kind: "skill",
      summary: row.summary,
      confidence: Number(row.confidence),
      chapterKeys: params.evidenceRefs
        .filter((ref) => ref.evidenceId === row.id && ref.refType === "chapter")
        .map((ref) => ref.refId),
      prerequisiteHints: [],
      relatedHints: [],
      evidenceSnippets: params.evidenceRefs
        .filter((ref) => ref.evidenceId === row.id && ref.snippet)
        .map((ref) => ref.snippet!)
        .filter(Boolean),
    })),
    existingNodes,
    existingEvidenceLinks,
    existingPrerequisiteEdges,
  });

  if (candidateSet.nodes.length === 0) {
    return buildBootstrapGrowthMerge(params.evidenceRows);
  }

  const planned = await planGrowthGraphMerge({
    userId: params.userId,
    courseId: params.plannerResourceId,
    candidateContext: candidateSet,
    evidenceBatch: params.evidenceRows,
    priorCourseSummary: params.priorSummary,
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

  if ((params.priorEdgeRunIds ?? []).length > 0) {
    await params.tx
      .delete(userSkillEdges)
      .where(inArray(userSkillEdges.sourceMergeRunId, params.priorEdgeRunIds!));
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
  userId: string;
  sourceType: string;
  sourceId: string;
}): Promise<string[]> {
  const rows = await db
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

import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import {
  db,
  knowledgeEvidence,
  knowledgeEvidenceEvents,
  knowledgeInsightEvidence,
  knowledgeInsights,
  userSkillNodeEvidence,
  userSkillNodes,
} from "@/db";
import {
  revalidateCareerTrees,
  revalidateNotesIndex,
  revalidateProfileStats,
} from "@/lib/cache/tags";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { getLatestFocusSnapshotRow } from "@/lib/growth/projection-data";
import { focusSnapshotPayloadSchema } from "@/lib/growth/projection-types";
import {
  deriveKnowledgeInsights,
  hashKnowledgeInsightInputs,
} from "@/lib/knowledge/insights/derive";
import type { GrowthJobData } from "@/lib/queue/growth-queue";

type JobPayload<T extends GrowthJobData["type"]> = Extract<GrowthJobData, { type: T }>;

type NodeEvidenceRow = {
  nodeId: string;
  evidenceId: string;
  sourceType: string;
  kind: string;
  title: string;
  summary: string;
  confidence: string;
};

type EnrichedSkillNode = {
  id: string;
  canonicalLabel: string;
  progress: number;
  state: string;
  evidenceScore: number;
  evidenceIds: string[];
  sourceTypes: string[];
  evidenceKinds: string[];
};

function compareInsightText(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans-CN");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, nestedValue]) => [key, sortObjectKeys(nestedValue)]),
    );
  }

  return value;
}

function pickStableInsightIdentityMetadata(metadata: Record<string, unknown>) {
  const stableMetadata: Record<string, unknown> = {};

  if (typeof metadata.nodeId === "string" && metadata.nodeId.length > 0) {
    stableMetadata.nodeId = metadata.nodeId;
  }

  if (typeof metadata.directionKey === "string" && metadata.directionKey.length > 0) {
    stableMetadata.directionKey = metadata.directionKey;
  }

  if (Array.isArray(metadata.evidenceIds) && metadata.evidenceIds.length > 0) {
    stableMetadata.evidenceIds = [...new Set(metadata.evidenceIds.map(String))].sort();
  }

  if (Array.isArray(metadata.sourceTypes) && metadata.sourceTypes.length > 0) {
    stableMetadata.sourceTypes = [...new Set(metadata.sourceTypes.map(String))].sort();
  }

  if (Array.isArray(metadata.evidenceKinds) && metadata.evidenceKinds.length > 0) {
    stableMetadata.evidenceKinds = [...new Set(metadata.evidenceKinds.map(String))].sort();
  }

  if (Array.isArray(metadata.recentEventIds) && metadata.recentEventIds.length > 0) {
    stableMetadata.recentEventIds = [...new Set(metadata.recentEventIds.map(String))].sort();
  }

  if (Array.isArray(metadata.eventKinds) && metadata.eventKinds.length > 0) {
    stableMetadata.eventKinds = [...new Set(metadata.eventKinds.map(String))].sort();
  }

  if (metadata.sourceBreakdown && typeof metadata.sourceBreakdown === "object") {
    stableMetadata.sourceBreakdown = sortObjectKeys(metadata.sourceBreakdown);
  }

  return stableMetadata;
}

function buildInsightMatchKey(insight: {
  kind: string;
  metadata: Record<string, unknown>;
}): string {
  const stableMetadata = pickStableInsightIdentityMetadata(insight.metadata);

  return JSON.stringify({
    kind: insight.kind,
    metadata: sortObjectKeys(stableMetadata),
  });
}

function assignInsightIds(
  insights: Array<{
    kind: string;
    title: string;
    summary: string;
    confidence: number;
    evidenceIds: string[];
    metadata: Record<string, unknown>;
  }>,
  existingRows: Array<{
    id: string;
    kind: string;
    title: string;
    metadata: Record<string, unknown> | null;
  }>,
) {
  const availableIdsByKey = new Map<string, string[]>();

  for (const row of existingRows) {
    const matchKey = buildInsightMatchKey({
      kind: row.kind,
      metadata: row.metadata ?? {},
    });
    const ids = availableIdsByKey.get(matchKey) ?? [];
    ids.push(row.id);
    availableIdsByKey.set(matchKey, ids);
  }

  const desiredInsights = insights.map((insight) => {
    const matchKey = buildInsightMatchKey(insight);
    const matchedId = availableIdsByKey.get(matchKey)?.shift();

    return {
      id: matchedId ?? randomUUID(),
      ...insight,
    };
  });

  const matchedIds = new Set(desiredInsights.map((insight) => insight.id));
  const obsoleteInsightIds = existingRows
    .map((row) => row.id)
    .filter((rowId) => !matchedIds.has(rowId));

  return { desiredInsights, obsoleteInsightIds };
}

function groupNodeEvidenceRows(rows: NodeEvidenceRow[]): Map<string, NodeEvidenceRow[]> {
  const rowsByNodeId = new Map<string, NodeEvidenceRow[]>();

  for (const row of rows) {
    const existing = rowsByNodeId.get(row.nodeId) ?? [];
    existing.push(row);
    rowsByNodeId.set(row.nodeId, existing);
  }

  return rowsByNodeId;
}

function sortLinkedEvidenceRows(rows: NodeEvidenceRow[]): NodeEvidenceRow[] {
  return [...rows].sort((left, right) => {
    const confidenceDiff = Number(right.confidence) - Number(left.confidence);
    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    const titleCompare = compareInsightText(left.title, right.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }

    return compareInsightText(left.evidenceId, right.evidenceId);
  });
}

function enrichSkillNodes(
  skillNodes: Array<{
    id: string;
    canonicalLabel: string;
    progress: number;
    state: string;
    evidenceScore: number;
  }>,
  nodeEvidenceRows: NodeEvidenceRow[],
): EnrichedSkillNode[] {
  const evidenceRowsByNodeId = groupNodeEvidenceRows(nodeEvidenceRows);

  return skillNodes.map((node) => {
    const linkedEvidenceRows = sortLinkedEvidenceRows(evidenceRowsByNodeId.get(node.id) ?? []);

    return {
      ...node,
      evidenceIds: uniqueStrings(linkedEvidenceRows.map((row) => row.evidenceId)),
      sourceTypes: uniqueStrings(linkedEvidenceRows.map((row) => row.sourceType)).sort(
        compareInsightText,
      ),
      evidenceKinds: uniqueStrings(linkedEvidenceRows.map((row) => row.kind)).sort(
        compareInsightText,
      ),
    };
  });
}

function buildDerivedFocusSnapshot(params: {
  focusSnapshotRow:
    | {
        directionKey: string | null;
        nodeId: string | null;
        title: string;
        summary: string;
        progress: number;
        state: string;
        payload: unknown;
      }
    | null
    | undefined;
  skillNodeById: Map<string, EnrichedSkillNode>;
}) {
  if (!params.focusSnapshotRow) {
    return null;
  }

  const parsedFocusPayload = focusSnapshotPayloadSchema.safeParse(params.focusSnapshotRow.payload);
  const focusAnchorRef = parsedFocusPayload.success
    ? (parsedFocusPayload.data.node?.anchorRef ?? params.focusSnapshotRow.nodeId ?? null)
    : (params.focusSnapshotRow.nodeId ?? null);

  return {
    directionKey: params.focusSnapshotRow.directionKey,
    anchorRef: focusAnchorRef,
    title: params.focusSnapshotRow.title,
    summary: params.focusSnapshotRow.summary,
    progress: params.focusSnapshotRow.progress,
    state: params.focusSnapshotRow.state,
    evidenceIds: uniqueStrings([
      ...(parsedFocusPayload.success ? (parsedFocusPayload.data.node?.evidenceRefs ?? []) : []),
      ...(focusAnchorRef ? (params.skillNodeById.get(focusAnchorRef)?.evidenceIds ?? []) : []),
    ]),
  };
}

export async function processKnowledgeInsightsJob(
  job: JobPayload<"derive_user_insights">,
): Promise<void> {
  const [evidenceRows, skillNodes, nodeEvidenceRows, recentEvents, focusSnapshotRow] =
    await Promise.all([
      db
        .select({
          id: knowledgeEvidence.id,
          title: knowledgeEvidence.title,
          summary: knowledgeEvidence.summary,
          confidence: knowledgeEvidence.confidence,
          kind: knowledgeEvidence.kind,
          sourceType: knowledgeEvidence.sourceType,
        })
        .from(knowledgeEvidence)
        .where(eq(knowledgeEvidence.userId, job.userId)),
      db
        .select({
          id: userSkillNodes.id,
          canonicalLabel: userSkillNodes.canonicalLabel,
          progress: userSkillNodes.progress,
          state: userSkillNodes.state,
          evidenceScore: userSkillNodes.evidenceScore,
        })
        .from(userSkillNodes)
        .where(eq(userSkillNodes.userId, job.userId)),
      db
        .select({
          nodeId: userSkillNodeEvidence.nodeId,
          evidenceId: knowledgeEvidence.id,
          sourceType: knowledgeEvidence.sourceType,
          kind: knowledgeEvidence.kind,
          title: knowledgeEvidence.title,
          summary: knowledgeEvidence.summary,
          confidence: knowledgeEvidence.confidence,
        })
        .from(userSkillNodeEvidence)
        .innerJoin(
          knowledgeEvidence,
          eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
        )
        .where(eq(userSkillNodeEvidence.userId, job.userId)),
      db
        .select({
          id: knowledgeEvidenceEvents.id,
          kind: knowledgeEvidenceEvents.kind,
          sourceType: knowledgeEvidenceEvents.sourceType,
        })
        .from(knowledgeEvidenceEvents)
        .where(eq(knowledgeEvidenceEvents.userId, job.userId))
        .orderBy(desc(knowledgeEvidenceEvents.happenedAt), desc(knowledgeEvidenceEvents.createdAt))
        .limit(12),
      getLatestFocusSnapshotRow(job.userId),
    ]);

  const enrichedSkillNodes = enrichSkillNodes(skillNodes, nodeEvidenceRows);

  const skillNodeById = new Map(enrichedSkillNodes.map((node) => [node.id, node]));
  const focusSnapshot = buildDerivedFocusSnapshot({
    focusSnapshotRow,
    skillNodeById,
  });

  const derivationInput = {
    evidenceRows,
    skillNodes: enrichedSkillNodes,
    recentEvents,
    focusSnapshot: focusSnapshot ?? null,
  };
  const insights = deriveKnowledgeInsights(derivationInput);
  const inputHash = hashKnowledgeInsightInputs(derivationInput);
  const run = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "insight",
    idempotencyKey: `insight:v4:user:${job.userId}:input:${inputHash}`,
    inputHash,
    model: "heuristic",
    promptVersion: "insight-derive@v4",
    reuseCompleted: true,
  });

  if (run.status === "succeeded") {
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const existingInsights = await tx
        .select({
          id: knowledgeInsights.id,
          kind: knowledgeInsights.kind,
          title: knowledgeInsights.title,
          metadata: knowledgeInsights.metadata,
        })
        .from(knowledgeInsights)
        .where(eq(knowledgeInsights.userId, job.userId));

      const { desiredInsights, obsoleteInsightIds } = assignInsightIds(insights, existingInsights);

      if (existingInsights.length > 0) {
        await tx.delete(knowledgeInsightEvidence).where(
          inArray(
            knowledgeInsightEvidence.insightId,
            existingInsights.map((row) => row.id),
          ),
        );
      }

      if (obsoleteInsightIds.length > 0) {
        await tx.delete(knowledgeInsights).where(inArray(knowledgeInsights.id, obsoleteInsightIds));
      }

      for (const insight of desiredInsights) {
        await tx
          .insert(knowledgeInsights)
          .values({
            id: insight.id,
            userId: job.userId,
            kind: insight.kind,
            title: insight.title,
            summary: insight.summary,
            confidence: insight.confidence.toFixed(3),
            metadata: insight.metadata,
            createdByRunId: run.id,
          })
          .onConflictDoUpdate({
            target: knowledgeInsights.id,
            set: {
              kind: insight.kind,
              title: insight.title,
              summary: insight.summary,
              confidence: insight.confidence.toFixed(3),
              metadata: insight.metadata,
              createdByRunId: run.id,
              updatedAt: new Date(),
            },
          });
      }

      const links = desiredInsights.flatMap((insight) =>
        insight.evidenceIds.map((evidenceId) => ({
          insightId: insight.id,
          evidenceId,
          weight: "1.000",
        })),
      );

      if (links.length > 0) {
        await tx.insert(knowledgeInsightEvidence).values(links);
      }

      await markGenerationRunSucceeded(tx, run.id, insights);
    });
  } catch (error) {
    await markGenerationRunFailed(run.id, error);
    throw error;
  }

  revalidateCareerTrees(job.userId);
  revalidateProfileStats(job.userId);
  revalidateNotesIndex(job.userId);
}

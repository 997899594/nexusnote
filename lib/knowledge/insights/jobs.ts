import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  knowledgeEvidence,
  knowledgeEvidenceEvents,
  knowledgeInsightEvidence,
  knowledgeInsights,
  userFocusSnapshots,
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
import {
  deriveKnowledgeInsights,
  hashKnowledgeInsightInputs,
} from "@/lib/knowledge/insights/derive";
import type { GrowthJobData } from "@/lib/queue/growth-queue";

type JobPayload<T extends GrowthJobData["type"]> = Extract<GrowthJobData, { type: T }>;

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

export async function processKnowledgeInsightsJob(
  job: JobPayload<"derive_user_insights">,
): Promise<void> {
  const [evidenceRows, skillNodes, recentEvents, focusSnapshot] = await Promise.all([
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
        id: knowledgeEvidenceEvents.id,
        kind: knowledgeEvidenceEvents.kind,
        sourceType: knowledgeEvidenceEvents.sourceType,
      })
      .from(knowledgeEvidenceEvents)
      .where(eq(knowledgeEvidenceEvents.userId, job.userId))
      .orderBy(desc(knowledgeEvidenceEvents.happenedAt), desc(knowledgeEvidenceEvents.createdAt))
      .limit(12),
    db.query.userFocusSnapshots.findFirst({
      where: and(eq(userFocusSnapshots.userId, job.userId), eq(userFocusSnapshots.isLatest, true)),
      orderBy: desc(userFocusSnapshots.createdAt),
      columns: {
        directionKey: true,
        nodeId: true,
        title: true,
        summary: true,
        progress: true,
        state: true,
      },
    }),
  ]);

  const derivationInput = {
    evidenceRows,
    skillNodes,
    recentEvents,
    focusSnapshot: focusSnapshot ?? null,
  };
  const insights = deriveKnowledgeInsights(derivationInput);
  const inputHash = hashKnowledgeInsightInputs(derivationInput);
  const run = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "insight",
    idempotencyKey: `insight:user:${job.userId}:input:${inputHash}`,
    inputHash,
    model: "heuristic",
    promptVersion: "insight-derive@v3",
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

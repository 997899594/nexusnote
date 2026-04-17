import { db } from "@/db";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { GROWTH_AI_MODEL_LABEL } from "@/lib/growth/constants";
import { loadSourceEvidenceRows } from "@/lib/growth/data-access";
import {
  applyValidatedGrowthMerge,
  listSourceMergeRunIds,
  planValidatedGrowthMerge,
} from "@/lib/growth/merge-execution";
import { enqueueGrowthRefresh } from "@/lib/growth/queue";
import { listLinkedNodeEvidenceRows } from "@/lib/knowledge/evidence/selectors";
import { listEvidenceSourceLinks } from "@/lib/knowledge/evidence/source-links";
import {
  computeEvidenceBatchHash,
  enqueueGrowthProjectionRefreshIfEnabled,
  enqueueKnowledgeInsightsIfEnabled,
  type GrowthJobExecutionOptions,
  type JobPayload,
} from "./shared";

async function handleEmptySourceEvidence(
  job: JobPayload<"merge_knowledge_source_evidence">,
  enqueueFollowups: boolean,
): Promise<void> {
  if ((job.affectedNodeIds ?? []).length === 0) {
    await enqueueKnowledgeInsightsIfEnabled(job.userId, enqueueFollowups);
    return;
  }

  if (enqueueFollowups) {
    await enqueueGrowthRefresh(
      job.userId,
      undefined,
      job.affectedNodeIds,
      `source-clear:${job.sourceType}:${job.sourceId}:${job.sourceVersionHash ?? "null"}`,
    );
  }
}

export async function processKnowledgeSourceMergeJob(
  job: JobPayload<"merge_knowledge_source_evidence">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;
  const evidenceRows = await loadSourceEvidenceRows({
    userId: job.userId,
    sourceType: job.sourceType,
    sourceId: job.sourceId,
    sourceVersionHash: job.sourceVersionHash,
  });
  const evidenceBatchHash = computeEvidenceBatchHash(evidenceRows);

  if (evidenceRows.length === 0) {
    await handleEmptySourceEvidence(job, enqueueFollowups);
    return;
  }

  const mergeRun = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:source:${job.sourceType}:${job.sourceId}:hash:${evidenceBatchHash}`,
    inputHash: evidenceBatchHash,
    model: GROWTH_AI_MODEL_LABEL,
    promptVersion: "growth-merge@v2",
    reuseCompleted: true,
  });

  if (mergeRun.status === "succeeded") {
    await enqueueGrowthProjectionRefreshIfEnabled(job.userId, enqueueFollowups);
    return;
  }

  const evidenceRefs = await listEvidenceSourceLinks({
    evidenceIds: evidenceRows.map((row) => row.id),
  });

  try {
    const validated = await planValidatedGrowthMerge({
      userId: job.userId,
      plannerResourceId: `${job.sourceType}:${job.sourceId}`,
      evidenceRows,
      evidenceRefs,
      priorSummary: {
        kind: "source",
        sourceType: job.sourceType,
        sourceId: job.sourceId,
      },
    });

    const priorSourceMergeRunIds = await listSourceMergeRunIds({
      userId: job.userId,
      sourceType: job.sourceType,
      sourceId: job.sourceId,
    });

    await db.transaction(async (tx) => {
      const existingSourceLinkRows = await listLinkedNodeEvidenceRows({
        executor: tx,
        userId: job.userId,
        sourceType: job.sourceType,
        sourceId: job.sourceId,
        sourceVersionHash: job.sourceVersionHash,
      });

      await applyValidatedGrowthMerge({
        tx,
        userId: job.userId,
        mergeRunId: mergeRun.id,
        validated,
        staleNodeEvidenceRows: existingSourceLinkRows,
        affectedNodeIds: job.affectedNodeIds,
        priorEdgeRunIds: priorSourceMergeRunIds,
      });
    });

    await markGenerationRunSucceeded(db, mergeRun.id, validated);
    await enqueueGrowthProjectionRefreshIfEnabled(job.userId, enqueueFollowups);
  } catch (error) {
    await markGenerationRunFailed(mergeRun.id, error);
    throw error;
  }
}

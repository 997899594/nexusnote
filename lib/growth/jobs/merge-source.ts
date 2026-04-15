import { and, eq } from "drizzle-orm";
import { db, knowledgeEvidence, userSkillNodeEvidence } from "@/db";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { GROWTH_AI_MODEL_LABEL } from "@/lib/growth/constants";
import { loadEvidenceRefs, loadSourceEvidenceRows } from "@/lib/growth/data-access";
import {
  applyValidatedGrowthMerge,
  listSourceMergeRunIds,
  planValidatedGrowthMerge,
} from "@/lib/growth/merge-execution";
import { enqueueGrowthRefresh, enqueueKnowledgeInsights } from "@/lib/growth/queue";
import { buildSourceVersionCondition } from "@/lib/growth/source-version";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";
import { computeEvidenceBatchHash, enqueueGrowthProjectionRefresh } from "./shared";

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
    if ((job.affectedNodeIds ?? []).length > 0) {
      if (enqueueFollowups) {
        await enqueueGrowthRefresh(
          job.userId,
          undefined,
          job.affectedNodeIds,
          `source-clear:${job.sourceType}:${job.sourceId}:${job.sourceVersionHash ?? "null"}`,
        );
      }
    } else if (enqueueFollowups) {
      await enqueueKnowledgeInsights(job.userId);
    }
    return;
  }

  const mergeRun = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:source:${job.sourceType}:${job.sourceId}:hash:${evidenceBatchHash}`,
    inputHash: evidenceBatchHash,
    model: GROWTH_AI_MODEL_LABEL,
    promptVersion: "growth-merge@v1",
    reuseCompleted: true,
  });

  if (mergeRun.status === "succeeded") {
    if (enqueueFollowups) {
      await enqueueGrowthProjectionRefresh(job.userId);
    }
    return;
  }

  const evidenceRefs = await loadEvidenceRefs(evidenceRows.map((row) => row.id));

  try {
    const validated = await planValidatedGrowthMerge({
      userId: job.userId,
      plannerResourceId: `${job.sourceType}:${job.sourceId}`,
      evidenceRows,
      evidenceRefs,
      priorSummary: {
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
      const existingSourceLinkRows = await tx
        .select({
          id: userSkillNodeEvidence.id,
          nodeId: userSkillNodeEvidence.nodeId,
        })
        .from(userSkillNodeEvidence)
        .innerJoin(
          knowledgeEvidence,
          eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
        )
        .where(
          and(
            eq(userSkillNodeEvidence.userId, job.userId),
            eq(knowledgeEvidence.sourceType, job.sourceType),
            eq(knowledgeEvidence.sourceId, job.sourceId),
            buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, job.sourceVersionHash),
          ),
        );

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
    if (enqueueFollowups) {
      await enqueueGrowthProjectionRefresh(job.userId);
    }
  } catch (error) {
    await markGenerationRunFailed(mergeRun.id, error);
    throw error;
  }
}

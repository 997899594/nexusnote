import { db } from "@/db";
import { GROWTH_MERGE_PROMPT_VERSION, GROWTH_MERGE_RUNTIME_LABEL } from "@/lib/growth/constants";
import { loadSourceEvidenceRows } from "@/lib/growth/data-access";
import {
  applyValidatedGrowthMerge,
  listCourseMergeRunIds,
  planValidatedGrowthMerge,
} from "@/lib/growth/merge-execution";
import { listLinkedNodeEvidenceRows } from "@/lib/knowledge/evidence/selectors";
import { listEvidenceSourceLinks } from "@/lib/knowledge/evidence/source-links";
import {
  getGenerationRunById,
  getLatestSucceededGenerationRun,
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/runtime/generation-runs";
import {
  enqueueGrowthProjectionRefreshIfEnabled,
  type GrowthJobExecutionOptions,
  type JobPayload,
} from "./shared";

async function loadExtractRun(job: JobPayload<"merge_user_skill_graph">) {
  if (job.extractRunId) {
    return getGenerationRunById(job.extractRunId);
  }

  return getLatestSucceededGenerationRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "extract",
  });
}

export async function processGrowthMergeJob(
  job: JobPayload<"merge_user_skill_graph">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;
  const extractRun = await loadExtractRun(job);

  if (!extractRun) {
    return;
  }

  const mergeRun = await getOrCreateGenerationRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:course:${job.courseId}:extract_run:${extractRun.id}:prompt:${GROWTH_MERGE_PROMPT_VERSION}`,
    inputHash: extractRun.inputHash,
    model: GROWTH_MERGE_RUNTIME_LABEL,
    promptVersion: GROWTH_MERGE_PROMPT_VERSION,
    reuseCompleted: true,
  });

  if (mergeRun.status === "succeeded") {
    await enqueueGrowthProjectionRefreshIfEnabled(job.userId, enqueueFollowups);
    return;
  }

  const evidenceRows = await loadSourceEvidenceRows({
    userId: job.userId,
    sourceType: "course",
    sourceId: job.courseId,
    sourceVersionHash: extractRun.inputHash,
    kind: "course_skill",
  });
  const evidenceRefs = await listEvidenceSourceLinks({
    evidenceIds: evidenceRows.map((row) => row.id),
  });

  try {
    const validated = await planValidatedGrowthMerge({
      userId: job.userId,
      evidenceRows,
      evidenceRefs,
    });

    await db.transaction(async (tx) => {
      const oldCourseLinkRows = await listLinkedNodeEvidenceRows({
        executor: tx,
        userId: job.userId,
        sourceType: "course",
        sourceId: job.courseId,
      });

      const priorMergeRunIds = await listCourseMergeRunIds({
        executor: tx,
        userId: job.userId,
        courseId: job.courseId,
      });

      await applyValidatedGrowthMerge({
        tx,
        userId: job.userId,
        mergeRunId: mergeRun.id,
        validated,
        staleNodeEvidenceRows: oldCourseLinkRows,
        affectedNodeIds: job.affectedNodeIds,
        priorEdgeRunIds: priorMergeRunIds,
      });
    });

    await markGenerationRunSucceeded(db, mergeRun.id, validated);
    await enqueueGrowthProjectionRefreshIfEnabled(job.userId, enqueueFollowups);
  } catch (error) {
    await markGenerationRunFailed(mergeRun.id, error);
    throw error;
  }
}

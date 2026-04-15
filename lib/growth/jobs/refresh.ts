import { and, eq } from "drizzle-orm";
import { db, knowledgeEvidence, userSkillNodeEvidence } from "@/db";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { recomputeNodeAggregates } from "@/lib/growth/aggregation";
import { bumpGrowthGraphState } from "@/lib/growth/graph-state";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";
import {
  computeGrowthRefreshInputHash,
  dedupeNodeIds,
  enqueueGrowthProjectionRefresh,
} from "./shared";

async function resolveRefreshNodeIds(
  job: JobPayload<"refresh_user_skill_graph">,
): Promise<string[]> {
  if (job.nodeIds && job.nodeIds.length > 0) {
    return dedupeNodeIds(job.nodeIds);
  }

  const rows = await db
    .select({
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
        eq(knowledgeEvidence.sourceType, "course"),
        job.courseId ? eq(knowledgeEvidence.sourceId, job.courseId) : undefined,
      ),
    );

  return dedupeNodeIds(rows.map((row) => row.nodeId));
}

export async function processGrowthRefreshJob(
  job: JobPayload<"refresh_user_skill_graph">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;
  const nodeIds = await resolveRefreshNodeIds(job);
  if (nodeIds.length === 0) {
    return;
  }

  const refreshInputHash = computeGrowthRefreshInputHash({
    courseId: job.courseId,
    nodeIds,
    reasonKey: job.reasonKey,
  });
  const refreshRun = await getOrCreateGenerationRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "refresh",
    idempotencyKey: `refresh:user:${job.userId}:input:${refreshInputHash}`,
    inputHash: refreshInputHash,
    model: "deterministic",
    promptVersion: "growth-refresh@v1",
    reuseCompleted: true,
  });

  if (refreshRun.status === "succeeded") {
    if (enqueueFollowups) {
      await enqueueGrowthProjectionRefresh(job.userId);
    }
    return;
  }

  try {
    await db.transaction(async (tx) => {
      await bumpGrowthGraphState(tx, { userId: job.userId });
      await recomputeNodeAggregates(tx, job.userId, nodeIds);
      await markGenerationRunSucceeded(tx, refreshRun.id, {
        courseId: job.courseId ?? null,
        refreshedNodeCount: nodeIds.length,
      });
    });

    if (enqueueFollowups) {
      await enqueueGrowthProjectionRefresh(job.userId);
    }
  } catch (error) {
    await markGenerationRunFailed(refreshRun.id, error);
    throw error;
  }
}

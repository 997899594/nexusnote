import { and, eq } from "drizzle-orm";
import { db, userFocusSnapshots, userProfileSnapshots } from "@/db";
import { revalidateCareerTrees, revalidateProfileStats } from "@/lib/cache/tags";
import { GROWTH_PROJECTION_RUNTIME_LABEL } from "@/lib/growth/constants";
import {
  getLatestFocusSnapshotRow,
  getLatestProfileSnapshotRow,
} from "@/lib/growth/projection-data";
import { buildGrowthViewProjectionArtifacts } from "@/lib/growth/projections";
import {
  getLatestCareerTreeSnapshotRow,
  parseCareerTreeSnapshotPayload,
} from "@/lib/growth/snapshot-data";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/runtime/generation-runs";
import {
  enqueueKnowledgeInsightsIfEnabled,
  type GrowthJobExecutionOptions,
  type JobPayload,
} from "./shared";

type ProjectionTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function loadLatestProjectionRows(userId: string) {
  return Promise.all([
    getLatestCareerTreeSnapshotRow(userId),
    getLatestFocusSnapshotRow(userId),
    getLatestProfileSnapshotRow(userId),
  ]);
}

async function clearLatestFocusSnapshots(tx: ProjectionTx, userId: string): Promise<void> {
  await tx
    .update(userFocusSnapshots)
    .set({ isLatest: false })
    .where(and(eq(userFocusSnapshots.userId, userId), eq(userFocusSnapshots.isLatest, true)));
}

async function clearLatestProfileSnapshots(tx: ProjectionTx, userId: string): Promise<void> {
  await tx
    .update(userProfileSnapshots)
    .set({ isLatest: false })
    .where(and(eq(userProfileSnapshots.userId, userId), eq(userProfileSnapshots.isLatest, true)));
}

export async function processGrowthProjectionJob(
  job: JobPayload<"project_user_growth_views">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;

  const [latestTreeSnapshotRow, latestFocusSnapshotRow, latestProfileSnapshotRow] =
    await loadLatestProjectionRows(job.userId);

  if (!latestTreeSnapshotRow) {
    return;
  }

  const parsedSnapshot = parseCareerTreeSnapshotPayload(latestTreeSnapshotRow.payload);
  if (!parsedSnapshot || parsedSnapshot.status !== "ready") {
    return;
  }

  if (parsedSnapshot.trees.length === 0) {
    return;
  }

  const projectionRun = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "projection",
    idempotencyKey: `projection:v2:user:${job.userId}:tree:${latestTreeSnapshotRow.id}`,
    inputHash: latestTreeSnapshotRow.id,
    model: GROWTH_PROJECTION_RUNTIME_LABEL,
    promptVersion: "growth-projection@v2",
    reuseCompleted: true,
  });

  const hasAlignedFocus = latestFocusSnapshotRow?.treeSnapshotId === latestTreeSnapshotRow.id;
  const hasAlignedProfile = latestProfileSnapshotRow?.treeSnapshotId === latestTreeSnapshotRow.id;

  if (projectionRun.status === "succeeded" && hasAlignedFocus && hasAlignedProfile) {
    await enqueueKnowledgeInsightsIfEnabled(job.userId, enqueueFollowups);
    return;
  }

  try {
    const projectionArtifacts = buildGrowthViewProjectionArtifacts(parsedSnapshot);
    const focusTitle =
      projectionArtifacts.focusNode?.title ?? projectionArtifacts.focusTree?.title ?? null;
    const focusSummary =
      projectionArtifacts.focusSummary ??
      projectionArtifacts.focusNode?.summary ??
      projectionArtifacts.focusTree?.whyThisDirection ??
      null;

    if (!focusTitle || !focusSummary) {
      throw new Error(`Missing focus projection for tree snapshot ${latestTreeSnapshotRow.id}`);
    }

    await db.transaction(async (tx) => {
      await clearLatestFocusSnapshots(tx, job.userId);

      const [focusSnapshot] = await tx
        .insert(userFocusSnapshots)
        .values({
          userId: job.userId,
          treeSnapshotId: latestTreeSnapshotRow.id,
          directionKey: projectionArtifacts.focusTree?.directionKey ?? null,
          nodeId: projectionArtifacts.focusNode?.anchorRef ?? null,
          title: focusTitle,
          summary: focusSummary,
          progress: projectionArtifacts.focusNode?.progress ?? 0,
          state: projectionArtifacts.focusNode?.state ?? "ready",
          payload: projectionArtifacts.focusPayload,
          isLatest: true,
          generatedAt: new Date(),
        })
        .returning({ id: userFocusSnapshots.id });

      await clearLatestProfileSnapshots(tx, job.userId);

      await tx.insert(userProfileSnapshots).values({
        userId: job.userId,
        treeSnapshotId: latestTreeSnapshotRow.id,
        focusSnapshotId: focusSnapshot?.id ?? null,
        payload: projectionArtifacts.profilePayload,
        isLatest: true,
        generatedAt: new Date(),
      });

      await markGenerationRunSucceeded(tx, projectionRun.id, {
        treeSnapshotId: latestTreeSnapshotRow.id,
        directionKey: projectionArtifacts.focusTree?.directionKey ?? null,
        nodeId: projectionArtifacts.focusNode?.anchorRef ?? null,
        focusScore: projectionArtifacts.focusScore,
      });
    });

    revalidateCareerTrees(job.userId);
    revalidateProfileStats(job.userId);

    await enqueueKnowledgeInsightsIfEnabled(job.userId, enqueueFollowups);
  } catch (error) {
    await markGenerationRunFailed(projectionRun.id, error);
    throw error;
  }
}

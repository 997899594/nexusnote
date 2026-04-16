import { and, desc, eq } from "drizzle-orm";
import { db, userCareerTreeSnapshots, userFocusSnapshots, userProfileSnapshots } from "@/db";
import { revalidateCareerTrees, revalidateProfileStats } from "@/lib/cache/tags";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { GROWTH_PROJECTION_RUNTIME_LABEL } from "@/lib/growth/constants";
import { buildGrowthViewProjectionArtifacts } from "@/lib/growth/projections";
import { enqueueKnowledgeInsights } from "@/lib/growth/queue";
import { careerTreeSnapshotSchema } from "@/lib/growth/types";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";

export async function processGrowthProjectionJob(
  job: JobPayload<"project_user_growth_views">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;

  const [latestTreeSnapshotRow, latestFocusSnapshotRow, latestProfileSnapshotRow] =
    await Promise.all([
      db.query.userCareerTreeSnapshots.findFirst({
        where: and(
          eq(userCareerTreeSnapshots.userId, job.userId),
          eq(userCareerTreeSnapshots.isLatest, true),
        ),
        orderBy: desc(userCareerTreeSnapshots.createdAt),
      }),
      db.query.userFocusSnapshots.findFirst({
        where: and(
          eq(userFocusSnapshots.userId, job.userId),
          eq(userFocusSnapshots.isLatest, true),
        ),
        orderBy: desc(userFocusSnapshots.createdAt),
      }),
      db.query.userProfileSnapshots.findFirst({
        where: and(
          eq(userProfileSnapshots.userId, job.userId),
          eq(userProfileSnapshots.isLatest, true),
        ),
        orderBy: desc(userProfileSnapshots.createdAt),
      }),
    ]);

  if (!latestTreeSnapshotRow) {
    return;
  }

  const parsedSnapshot = careerTreeSnapshotSchema.safeParse(latestTreeSnapshotRow.payload);
  if (!parsedSnapshot.success || parsedSnapshot.data.status !== "ready") {
    return;
  }

  if (parsedSnapshot.data.trees.length === 0) {
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
    if (enqueueFollowups) {
      await enqueueKnowledgeInsights(job.userId);
    }
    return;
  }

  try {
    const projectionArtifacts = buildGrowthViewProjectionArtifacts(parsedSnapshot.data);
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
      await tx
        .update(userFocusSnapshots)
        .set({ isLatest: false })
        .where(
          and(eq(userFocusSnapshots.userId, job.userId), eq(userFocusSnapshots.isLatest, true)),
        );

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

      await tx
        .update(userProfileSnapshots)
        .set({ isLatest: false })
        .where(
          and(eq(userProfileSnapshots.userId, job.userId), eq(userProfileSnapshots.isLatest, true)),
        );

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

    if (enqueueFollowups) {
      await enqueueKnowledgeInsights(job.userId);
    }
  } catch (error) {
    await markGenerationRunFailed(projectionRun.id, error);
    throw error;
  }
}

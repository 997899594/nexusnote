import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  courses,
  db,
  knowledgeEvidence,
  knowledgeEvidenceSourceLinks,
  userCareerTreeSnapshots,
  userSkillEdges,
  userSkillNodeEvidence,
  userSkillNodes,
} from "@/db";
import { revalidateCareerTrees } from "@/lib/cache/tags";
import {
  composeGrowthTrees,
  resolveDirectionKeys,
  sortResolvedTreesByPreference,
  treeComposerOutputSchema,
} from "@/lib/growth/compose";
import { CAREER_TREE_SCHEMA_VERSION, GROWTH_COMPOSE_MODEL_LABEL } from "@/lib/growth/constants";
import { getGrowthGraphStateRow } from "@/lib/growth/graph-state";
import { getGrowthPreference } from "@/lib/growth/preferences";
import { buildComposeGraph, buildGrowthSnapshotArtifacts } from "@/lib/growth/projections";
import { enqueueGrowthProjection } from "@/lib/growth/queue";
import { getLatestCareerTreeSnapshotRow } from "@/lib/growth/snapshot-data";
import {
  getGenerationRunById,
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/runtime/generation-runs";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";

const supportingRefCourses = alias(courses, "supporting_ref_courses");

async function enqueueProjectionIfNeeded(userId: string, enqueueFollowups: boolean): Promise<void> {
  if (!enqueueFollowups) {
    return;
  }

  await enqueueGrowthProjection(userId);
}

function resolvePreviousDirections(outputJson: unknown): Array<{
  directionKey: string;
  supportingNodeRefs: string[];
}> {
  if (!outputJson || typeof outputJson !== "object" || !("trees" in outputJson)) {
    return [];
  }

  const previousTrees = outputJson.trees;
  if (!Array.isArray(previousTrees)) {
    return [];
  }

  return previousTrees
    .filter(
      (
        tree,
      ): tree is {
        directionKey?: string;
        matchPreviousDirectionKey?: string;
        keySeed?: string;
        supportingNodeRefs: string[];
      } =>
        typeof tree === "object" &&
        tree !== null &&
        "supportingNodeRefs" in tree &&
        Array.isArray(tree.supportingNodeRefs),
    )
    .map((tree) => ({
      directionKey: tree.directionKey ?? tree.matchPreviousDirectionKey ?? tree.keySeed ?? "",
      supportingNodeRefs: tree.supportingNodeRefs,
    }))
    .filter((tree) => tree.directionKey.length > 0);
}

export async function processGrowthComposeJob(
  job: JobPayload<"compose_user_growth_snapshot">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;
  const [userCourses, graphState, preference, nodes, edges, latestSnapshot] = await Promise.all([
    db.select({ id: courses.id }).from(courses).where(eq(courses.userId, job.userId)).limit(1),
    getGrowthGraphStateRow(job.userId),
    getGrowthPreference(job.userId),
    db.select().from(userSkillNodes).where(eq(userSkillNodes.userId, job.userId)),
    db.select().from(userSkillEdges).where(eq(userSkillEdges.userId, job.userId)),
    getLatestCareerTreeSnapshotRow(job.userId),
  ]);

  if (userCourses.length === 0) {
    return;
  }

  const composeRun = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "compose",
    idempotencyKey: `compose:user:${job.userId}:graph:${graphState?.graphVersion ?? 0}:pref:${preference.preferenceVersion}`,
    inputHash: `${graphState?.graphVersion ?? 0}:${preference.preferenceVersion}`,
    model: GROWTH_COMPOSE_MODEL_LABEL,
    promptVersion: "growth-compose@v4",
    reuseCompleted: true,
  });

  if (composeRun.status === "succeeded") {
    await enqueueProjectionIfNeeded(job.userId, enqueueFollowups);
    return;
  }

  if (nodes.length === 0) {
    return;
  }

  const previousComposeRun = latestSnapshot?.composeRunId
    ? await getGenerationRunById(latestSnapshot.composeRunId)
    : null;

  try {
    const composed = await composeGrowthTrees({
      userId: job.userId,
      graph: buildComposeGraph(nodes, edges),
      preference,
      previousSummary: previousComposeRun?.outputJson ?? null,
    });

    const parsed = treeComposerOutputSchema.parse(composed);
    const resolvedTrees = resolveDirectionKeys({
      trees: parsed.trees,
      previousDirections: resolvePreviousDirections(previousComposeRun?.outputJson ?? null),
    });
    const sortedTrees = sortResolvedTreesByPreference({
      trees: resolvedTrees,
      preference,
    });

    const nodeEvidenceRows = await db
      .select({
        nodeId: userSkillNodeEvidence.nodeId,
        evidenceId: knowledgeEvidence.id,
        sourceType: knowledgeEvidence.sourceType,
        sourceId: knowledgeEvidence.sourceId,
        sourceCourseTitle: courses.title,
        refType: knowledgeEvidenceSourceLinks.refType,
        refId: knowledgeEvidenceSourceLinks.refId,
        refSnippet: knowledgeEvidenceSourceLinks.snippet,
        refCourseTitle: supportingRefCourses.title,
      })
      .from(userSkillNodeEvidence)
      .innerJoin(
        knowledgeEvidence,
        eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
      )
      .leftJoin(courses, sql`${courses.id}::text = ${knowledgeEvidence.sourceId}`)
      .leftJoin(
        knowledgeEvidenceSourceLinks,
        eq(knowledgeEvidenceSourceLinks.evidenceId, knowledgeEvidence.id),
      )
      .leftJoin(
        supportingRefCourses,
        sql`${supportingRefCourses.id}::text = ${knowledgeEvidenceSourceLinks.refId}`,
      )
      .where(eq(userSkillNodeEvidence.userId, job.userId));

    const snapshotArtifacts = buildGrowthSnapshotArtifacts({
      resolvedTrees: sortedTrees,
      recommendedDirectionHint: parsed.recommendedDirectionHint ?? null,
      selectedDirectionKey: preference.selectedDirectionKey,
      hiddenNodes: nodes,
      supportingRows: nodeEvidenceRows,
    });
    const { snapshot: payload, recommendedDirectionKey } = snapshotArtifacts;

    await db.transaction(async (tx) => {
      await tx
        .update(userCareerTreeSnapshots)
        .set({ isLatest: false })
        .where(
          and(
            eq(userCareerTreeSnapshots.userId, job.userId),
            eq(userCareerTreeSnapshots.isLatest, true),
          ),
        );

      await tx.insert(userCareerTreeSnapshots).values({
        userId: job.userId,
        composeRunId: composeRun.id,
        schemaVersion: CAREER_TREE_SCHEMA_VERSION,
        status: "ready",
        recommendedDirectionKey,
        selectedDirectionKey: preference.selectedDirectionKey,
        graphVersion: graphState?.graphVersion ?? 0,
        preferenceVersion: preference.preferenceVersion,
        payload,
        isLatest: true,
        generatedAt: new Date(),
      });

      await markGenerationRunSucceeded(tx, composeRun.id, {
        recommendedDirectionHint: parsed.recommendedDirectionHint ?? null,
        trees: sortedTrees,
      });
    });

    revalidateCareerTrees(job.userId);
    await enqueueProjectionIfNeeded(job.userId, enqueueFollowups);
  } catch (error) {
    await markGenerationRunFailed(composeRun.id, error);
    throw error;
  }
}

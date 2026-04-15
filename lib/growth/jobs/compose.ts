import { and, desc, eq, sql } from "drizzle-orm";
import {
  courses,
  db,
  knowledgeEvidence,
  knowledgeEvidenceSourceLinks,
  knowledgeGenerationRuns,
  userCareerTreeSnapshots,
  userGrowthState,
  userSkillEdges,
  userSkillNodeEvidence,
  userSkillNodes,
} from "@/db";
import { revalidateCareerTrees } from "@/lib/cache/tags";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import {
  composeGrowthTrees,
  resolveDirectionKeys,
  treeComposerOutputSchema,
} from "@/lib/growth/compose";
import { CAREER_TREE_SCHEMA_VERSION, GROWTH_COMPOSE_RUNTIME_LABEL } from "@/lib/growth/constants";
import { getGrowthPreference } from "@/lib/growth/preferences";
import { buildComposeGraph, buildGrowthSnapshotArtifacts } from "@/lib/growth/projections";
import { enqueueGrowthProjection } from "@/lib/growth/queue";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";

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
    db.query.userGrowthState.findFirst({
      where: eq(userGrowthState.userId, job.userId),
    }),
    getGrowthPreference(job.userId),
    db.select().from(userSkillNodes).where(eq(userSkillNodes.userId, job.userId)),
    db.select().from(userSkillEdges).where(eq(userSkillEdges.userId, job.userId)),
    db.query.userCareerTreeSnapshots.findFirst({
      where: and(
        eq(userCareerTreeSnapshots.userId, job.userId),
        eq(userCareerTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(userCareerTreeSnapshots.createdAt),
    }),
  ]);

  if (userCourses.length === 0) {
    return;
  }

  const composeRun = await getOrCreateGenerationRun({
    userId: job.userId,
    kind: "compose",
    idempotencyKey: `compose:user:${job.userId}:graph:${graphState?.graphVersion ?? 0}:pref:${preference.preferenceVersion}`,
    inputHash: `${graphState?.graphVersion ?? 0}:${preference.preferenceVersion}`,
    model: GROWTH_COMPOSE_RUNTIME_LABEL,
    promptVersion: "growth-compose@v1",
    reuseCompleted: true,
  });

  if (composeRun.status === "succeeded") {
    if (enqueueFollowups) {
      await enqueueGrowthProjection(job.userId);
    }
    return;
  }

  if (nodes.length === 0) {
    return;
  }

  const previousComposeRun = latestSnapshot?.composeRunId
    ? await db.query.knowledgeGenerationRuns.findFirst({
        where: eq(knowledgeGenerationRuns.id, latestSnapshot.composeRunId),
      })
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

    const nodeEvidenceRows = await db
      .select({
        nodeId: userSkillNodeEvidence.nodeId,
        sourceId: knowledgeEvidence.sourceId,
        courseTitle: courses.title,
        refType: knowledgeEvidenceSourceLinks.refType,
        refId: knowledgeEvidenceSourceLinks.refId,
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
      .where(eq(userSkillNodeEvidence.userId, job.userId));

    const snapshotArtifacts = buildGrowthSnapshotArtifacts({
      resolvedTrees,
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
        trees: resolvedTrees,
      });
    });

    revalidateCareerTrees(job.userId);
    if (enqueueFollowups) {
      await enqueueGrowthProjection(job.userId);
    }
  } catch (error) {
    await markGenerationRunFailed(composeRun.id, error);
    throw error;
  }
}

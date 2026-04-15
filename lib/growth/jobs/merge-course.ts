import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  knowledgeEvidence,
  knowledgeEvidenceSourceLinks,
  knowledgeGenerationRuns,
  userSkillNodeEvidence,
} from "@/db";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { GROWTH_AI_MODEL_LABEL } from "@/lib/growth/constants";
import { applyValidatedGrowthMerge, planValidatedGrowthMerge } from "@/lib/growth/merge-execution";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";
import { enqueueGrowthProjectionRefresh } from "./shared";

export async function processGrowthMergeJob(
  job: JobPayload<"merge_user_skill_graph">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;
  const extractRun = job.extractRunId
    ? await db.query.knowledgeGenerationRuns.findFirst({
        where: eq(knowledgeGenerationRuns.id, job.extractRunId),
      })
    : await db.query.knowledgeGenerationRuns.findFirst({
        where: and(
          eq(knowledgeGenerationRuns.userId, job.userId),
          eq(knowledgeGenerationRuns.courseId, job.courseId),
          eq(knowledgeGenerationRuns.kind, "extract"),
          eq(knowledgeGenerationRuns.status, "succeeded"),
        ),
        orderBy: desc(knowledgeGenerationRuns.createdAt),
      });

  if (!extractRun) {
    return;
  }

  const mergeRun = await getOrCreateGenerationRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:course:${job.courseId}:extract_run:${extractRun.id}`,
    inputHash: extractRun.inputHash,
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

  const evidenceRows = await db
    .select({
      id: knowledgeEvidence.id,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      sourceVersionHash: knowledgeEvidence.sourceVersionHash,
    })
    .from(knowledgeEvidence)
    .where(
      and(
        eq(knowledgeEvidence.userId, job.userId),
        eq(knowledgeEvidence.sourceType, "course"),
        eq(knowledgeEvidence.sourceId, job.courseId),
        eq(knowledgeEvidence.kind, "course_skill"),
        eq(knowledgeEvidence.sourceVersionHash, extractRun.inputHash),
      ),
    );

  const evidenceRefs =
    evidenceRows.length > 0
      ? await db
          .select({
            evidenceId: knowledgeEvidenceSourceLinks.evidenceId,
            refType: knowledgeEvidenceSourceLinks.refType,
            refId: knowledgeEvidenceSourceLinks.refId,
            snippet: knowledgeEvidenceSourceLinks.snippet,
          })
          .from(knowledgeEvidenceSourceLinks)
          .where(
            inArray(
              knowledgeEvidenceSourceLinks.evidenceId,
              evidenceRows.map((row) => row.id),
            ),
          )
      : [];

  const priorCourseLinks = await db
    .select({
      nodeId: userSkillNodeEvidence.nodeId,
      evidenceId: userSkillNodeEvidence.knowledgeEvidenceId,
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
        eq(knowledgeEvidence.sourceId, job.courseId),
      ),
    );

  try {
    const validated = await planValidatedGrowthMerge({
      userId: job.userId,
      plannerResourceId: job.courseId,
      evidenceRows,
      evidenceRefs,
      priorSummary: priorCourseLinks,
    });

    await db.transaction(async (tx) => {
      const oldCourseLinkRows = await tx
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
            eq(knowledgeEvidence.sourceType, "course"),
            eq(knowledgeEvidence.sourceId, job.courseId),
          ),
        );

      const priorMergeRuns = await tx
        .select({ id: knowledgeGenerationRuns.id })
        .from(knowledgeGenerationRuns)
        .where(
          and(
            eq(knowledgeGenerationRuns.userId, job.userId),
            eq(knowledgeGenerationRuns.courseId, job.courseId),
            eq(knowledgeGenerationRuns.kind, "merge"),
          ),
        );

      await applyValidatedGrowthMerge({
        tx,
        userId: job.userId,
        mergeRunId: mergeRun.id,
        validated,
        staleNodeEvidenceRows: oldCourseLinkRows,
        affectedNodeIds: job.affectedNodeIds,
        priorEdgeRunIds: priorMergeRuns.map((row) => row.id),
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

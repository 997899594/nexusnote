import { and, eq } from "drizzle-orm";
import {
  careerCourseSkillEvidence,
  careerUserSkillEdges,
  careerUserSkillNodeEvidence,
  careerUserSkillNodes,
  db,
} from "@/db";
import {
  CAREER_IN_PROGRESS_THRESHOLD,
  CAREER_MASTERED_EVIDENCE_THRESHOLD,
  CAREER_MASTERED_PROGRESS_THRESHOLD,
  CAREER_READY_PREREQ_PROGRESS_THRESHOLD,
} from "@/lib/career-tree/constants";
import { getCareerCourseProgressMap, getCareerCourseSource } from "@/lib/career-tree/source";

type CareerAggregationExecutor = Pick<typeof db, "select" | "update">;

interface AggregationInput {
  chapterCompletionRatios: Array<{ ratio: number; confidence: number }>;
  fallbackCourseProgressRatios: Array<{ ratio: number; confidence: number }>;
  courseCount: number;
  chapterCount: number;
  repeatedEvidenceCount: number;
  prerequisiteProgresses: number[];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeProgress(input: AggregationInput): number {
  const sources =
    input.chapterCompletionRatios.length > 0
      ? input.chapterCompletionRatios
      : input.fallbackCourseProgressRatios;

  if (sources.length === 0) {
    return 0;
  }

  const totalWeight = sources.reduce((sum, item) => sum + item.confidence, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const weightedValue = sources.reduce((sum, item) => sum + item.ratio * item.confidence, 0);
  return clampPercent(weightedValue / totalWeight);
}

function computeEvidenceScore(input: AggregationInput): number {
  const support =
    input.chapterCompletionRatios.reduce((sum, item) => sum + item.confidence * 20, 0) +
    input.fallbackCourseProgressRatios.reduce((sum, item) => sum + item.confidence * 10, 0);
  return clampPercent(Math.min(100, support));
}

function computeMasteryScore(progress: number, input: AggregationInput): number {
  return clampPercent(
    progress * 0.7 +
      Math.min(20, input.courseCount * 5) +
      Math.min(10, input.repeatedEvidenceCount * 2),
  );
}

function resolveCareerNodeState(
  progress: number,
  evidenceScore: number,
  prerequisiteProgresses: number[],
): "mastered" | "in_progress" | "ready" | "locked" {
  if (
    progress >= CAREER_MASTERED_PROGRESS_THRESHOLD &&
    evidenceScore >= CAREER_MASTERED_EVIDENCE_THRESHOLD
  ) {
    return "mastered";
  }

  if (progress >= CAREER_IN_PROGRESS_THRESHOLD) {
    return "in_progress";
  }

  const prerequisitesReady =
    prerequisiteProgresses.length === 0 ||
    prerequisiteProgresses.every((value) => value >= CAREER_READY_PREREQ_PROGRESS_THRESHOLD);

  return prerequisitesReady ? "ready" : "locked";
}

function buildChapterProgressMap(params: {
  chapterKeys: string[];
  completedSections: string[];
  completedChapters: number[];
  sectionsByChapterKey: Map<string, string[]>;
}) {
  const completedSectionSet = new Set(params.completedSections);
  const completedChapterSet = new Set(params.completedChapters);
  const chapterRatios = new Map<string, number>();

  for (const [index, chapterKey] of params.chapterKeys.entries()) {
    const sectionKeys = params.sectionsByChapterKey.get(chapterKey) ?? [];
    if (sectionKeys.length > 0) {
      const completed = sectionKeys.filter((sectionKey) =>
        completedSectionSet.has(sectionKey),
      ).length;
      chapterRatios.set(chapterKey, (completed / sectionKeys.length) * 100);
      continue;
    }

    chapterRatios.set(chapterKey, completedChapterSet.has(index) ? 100 : 0);
  }

  const courseRatio =
    chapterRatios.size > 0
      ? [...chapterRatios.values()].reduce((sum, ratio) => sum + ratio, 0) / chapterRatios.size
      : 0;

  return {
    chapterRatios,
    courseRatio,
  };
}

export async function recomputeCareerNodeAggregates(
  executor: CareerAggregationExecutor,
  userId: string,
  nodeIds: string[],
) {
  const uniqueNodeIds = [...new Set(nodeIds)];
  if (uniqueNodeIds.length === 0) {
    return;
  }

  for (const nodeId of uniqueNodeIds) {
    const linkedEvidenceRows = await executor
      .select({
        evidenceId: careerCourseSkillEvidence.id,
        courseId: careerCourseSkillEvidence.courseId,
        confidence: careerCourseSkillEvidence.confidence,
        chapterRefs: careerCourseSkillEvidence.chapterRefs,
      })
      .from(careerUserSkillNodeEvidence)
      .innerJoin(
        careerCourseSkillEvidence,
        eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
      )
      .where(eq(careerUserSkillNodeEvidence.nodeId, nodeId));

    const courseIds = [...new Set(linkedEvidenceRows.map((row) => row.courseId))];
    const progressByCourseId = await getCareerCourseProgressMap(userId, courseIds);
    const chapterCompletionRatios: AggregationInput["chapterCompletionRatios"] = [];
    const fallbackCourseProgressRatios: AggregationInput["fallbackCourseProgressRatios"] = [];
    const chapterKeys = new Set<string>();

    for (const courseId of courseIds) {
      const course = await getCareerCourseSource(userId, courseId);
      if (!course) {
        continue;
      }

      const progress = progressByCourseId.get(courseId) ?? {
        completedChapters: [],
        completedSections: [],
      };
      const chapterProgress = buildChapterProgressMap({
        chapterKeys: course.outline.chapters.map((chapter) => chapter.chapterKey),
        completedSections: progress.completedSections,
        completedChapters: progress.completedChapters,
        sectionsByChapterKey: new Map(
          course.outline.chapters.map((chapter) => [
            chapter.chapterKey,
            chapter.sections.map((section) => section.sectionKey),
          ]),
        ),
      });
      const courseEvidenceRows = linkedEvidenceRows.filter((row) => row.courseId === courseId);

      for (const row of courseEvidenceRows) {
        const confidence = Number(row.confidence);
        if (row.chapterRefs.length === 0) {
          fallbackCourseProgressRatios.push({
            ratio: chapterProgress.courseRatio,
            confidence,
          });
          continue;
        }

        for (const chapterKey of row.chapterRefs) {
          chapterKeys.add(`${courseId}:${chapterKey}`);
          chapterCompletionRatios.push({
            ratio: chapterProgress.chapterRatios.get(chapterKey) ?? chapterProgress.courseRatio,
            confidence,
          });
        }
      }
    }

    const prerequisiteSourceRows = await executor
      .select({
        progress: careerUserSkillNodes.progress,
      })
      .from(careerUserSkillEdges)
      .innerJoin(careerUserSkillNodes, eq(careerUserSkillEdges.fromNodeId, careerUserSkillNodes.id))
      .where(
        and(
          eq(careerUserSkillEdges.toNodeId, nodeId),
          eq(careerUserSkillEdges.edgeType, "prerequisite"),
        ),
      );

    const aggregationInput: AggregationInput = {
      chapterCompletionRatios,
      fallbackCourseProgressRatios,
      courseCount: courseIds.length,
      chapterCount: chapterKeys.size,
      repeatedEvidenceCount: Math.max(0, linkedEvidenceRows.length - courseIds.length),
      prerequisiteProgresses: prerequisiteSourceRows.map((row) => row.progress),
    };

    const progress = computeProgress(aggregationInput);
    const evidenceScore = computeEvidenceScore(aggregationInput);
    const masteryScore = computeMasteryScore(progress, aggregationInput);
    const state = resolveCareerNodeState(
      progress,
      evidenceScore,
      aggregationInput.prerequisiteProgresses,
    );

    await executor
      .update(careerUserSkillNodes)
      .set({
        progress,
        evidenceScore,
        masteryScore,
        state,
        courseCount: aggregationInput.courseCount,
        chapterCount: aggregationInput.chapterCount,
        updatedAt: new Date(),
        lastMergedAt: new Date(),
      })
      .where(eq(careerUserSkillNodes.id, nodeId));
  }
}

export async function recomputeAllCareerNodeAggregatesForUser(userId: string): Promise<string[]> {
  const nodes = await db
    .select({ id: careerUserSkillNodes.id })
    .from(careerUserSkillNodes)
    .where(eq(careerUserSkillNodes.userId, userId));
  const nodeIds = nodes.map((node) => node.id);
  await recomputeCareerNodeAggregates(db, userId, nodeIds);
  return nodeIds;
}

export async function listCareerNodesLinkedToCourse(params: {
  userId: string;
  courseId: string;
}): Promise<string[]> {
  const rows = await db
    .select({ nodeId: careerUserSkillNodeEvidence.nodeId })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      careerCourseSkillEvidence,
      eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
    )
    .where(
      and(
        eq(careerUserSkillNodeEvidence.userId, params.userId),
        eq(careerCourseSkillEvidence.courseId, params.courseId),
      ),
    );

  return [...new Set(rows.map((row) => row.nodeId))];
}

export async function recomputeCareerNodesForCourse(params: {
  userId: string;
  courseId: string;
}): Promise<string[]> {
  const nodeIds = await listCareerNodesLinkedToCourse(params);
  if (nodeIds.length > 0) {
    await recomputeCareerNodeAggregates(db, params.userId, nodeIds);
  }
  return nodeIds;
}

export async function recomputeSpecificCareerNodes(params: {
  userId: string;
  nodeIds: string[];
}): Promise<void> {
  if (params.nodeIds.length === 0) {
    return;
  }

  await recomputeCareerNodeAggregates(
    db,
    params.userId,
    params.nodeIds.length > 0 ? [...new Set(params.nodeIds)] : [],
  );
}

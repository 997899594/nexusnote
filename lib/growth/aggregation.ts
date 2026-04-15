import { and, eq, inArray } from "drizzle-orm";
import {
  courseOutlineNodes,
  courseOutlineVersions,
  courseProgress,
  courses,
  db,
  knowledgeEvidence,
  knowledgeEvidenceSourceLinks,
  userSkillEdges,
  userSkillNodeEvidence,
  userSkillNodes,
} from "@/db";
import {
  type AggregationInput,
  computeEvidenceScore,
  computeMasteryScore,
  computeProgress,
  resolveGrowthNodeState,
} from "@/lib/growth/merge";
import {
  type NormalizedGrowthOutline,
  normalizeGrowthOutline,
} from "@/lib/growth/normalize-outline";

export type GrowthExecutor = Pick<typeof db, "select" | "update">;

function buildChapterProgressMap(
  outline: NormalizedGrowthOutline,
  completedSections: string[] | null,
  completedChapters: number[] | null,
) {
  const completedSectionSet = new Set(completedSections ?? []);
  const completedChapterSet = new Set(completedChapters ?? []);
  const chapterRatios = new Map<string, number>();

  let totalSections = 0;
  let totalCompletedSections = 0;

  for (const chapter of outline.chapters) {
    if (chapter.sections.length > 0) {
      const completed = chapter.sections.filter((section) =>
        completedSectionSet.has(section.sectionKey),
      ).length;
      totalSections += chapter.sections.length;
      totalCompletedSections += completed;
      chapterRatios.set(chapter.chapterKey, (completed / chapter.sections.length) * 100);
      continue;
    }

    const chapterCompleted = completedChapterSet.has(chapter.chapterIndex);
    chapterRatios.set(chapter.chapterKey, chapterCompleted ? 100 : 0);
  }

  const courseRatio = totalSections > 0 ? (totalCompletedSections / totalSections) * 100 : 0;

  return {
    chapterRatios,
    courseRatio,
  };
}

export async function recomputeNodeAggregates(
  executor: GrowthExecutor,
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
        evidenceId: knowledgeEvidence.id,
        sourceType: knowledgeEvidence.sourceType,
        sourceId: knowledgeEvidence.sourceId,
        confidence: knowledgeEvidence.confidence,
      })
      .from(userSkillNodeEvidence)
      .innerJoin(
        knowledgeEvidence,
        eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
      )
      .where(eq(userSkillNodeEvidence.nodeId, nodeId));

    const linkedRefs =
      linkedEvidenceRows.length > 0
        ? await db
            .select({
              evidenceId: knowledgeEvidenceSourceLinks.evidenceId,
              refType: knowledgeEvidenceSourceLinks.refType,
              refId: knowledgeEvidenceSourceLinks.refId,
            })
            .from(knowledgeEvidenceSourceLinks)
            .where(
              inArray(
                knowledgeEvidenceSourceLinks.evidenceId,
                linkedEvidenceRows.map((row) => row.evidenceId),
              ),
            )
        : [];

    const linkedCourseIds = [
      ...new Set(
        linkedEvidenceRows
          .filter((row) => row.sourceType === "course" && row.sourceId)
          .map((row) => row.sourceId as string),
      ),
    ];

    const courseRows =
      linkedCourseIds.length > 0
        ? await db
            .select({
              courseId: courses.id,
              outlineVersionId: courseOutlineVersions.id,
              outlineVersionTitle: courseOutlineVersions.title,
              outlineVersionDescription: courseOutlineVersions.description,
              outlineVersionTargetAudience: courseOutlineVersions.targetAudience,
              outlineVersionDifficulty: courseOutlineVersions.difficulty,
              outlineVersionLearningOutcome: courseOutlineVersions.learningOutcome,
              outlineVersionCourseSkillIds: courseOutlineVersions.courseSkillIds,
              outlineVersionPrerequisites: courseOutlineVersions.prerequisites,
              nodeType: courseOutlineNodes.nodeType,
              nodeKey: courseOutlineNodes.nodeKey,
              parentNodeKey: courseOutlineNodes.parentNodeKey,
              chapterIndex: courseOutlineNodes.chapterIndex,
              sectionIndex: courseOutlineNodes.sectionIndex,
              position: courseOutlineNodes.position,
              nodeTitle: courseOutlineNodes.title,
              nodeDescription: courseOutlineNodes.description,
              nodeSkillIds: courseOutlineNodes.skillIds,
              nodePracticeType: courseOutlineNodes.practiceType,
              completedSections: courseProgress.completedSections,
              completedChapters: courseProgress.completedChapters,
            })
            .from(courses)
            .innerJoin(
              courseOutlineVersions,
              and(
                eq(courseOutlineVersions.courseId, courses.id),
                eq(courseOutlineVersions.isLatest, true),
              ),
            )
            .innerJoin(
              courseOutlineNodes,
              eq(courseOutlineNodes.outlineVersionId, courseOutlineVersions.id),
            )
            .leftJoin(
              courseProgress,
              and(eq(courseProgress.courseId, courses.id), eq(courseProgress.userId, userId)),
            )
            .where(inArray(courses.id, linkedCourseIds))
        : [];

    const courseRowsById = new Map<(typeof courseRows)[number]["courseId"], typeof courseRows>();
    for (const row of courseRows) {
      const existing = courseRowsById.get(row.courseId) ?? [];
      existing.push(row);
      courseRowsById.set(row.courseId, existing);
    }

    const chapterCompletionRatios: AggregationInput["chapterCompletionRatios"] = [];
    const fallbackCourseProgressRatios: AggregationInput["fallbackCourseProgressRatios"] = [];
    const courseIds = new Set<string>();
    const chapterKeys = new Set<string>();

    for (const row of linkedEvidenceRows) {
      if (row.sourceType !== "course" || !row.sourceId) {
        continue;
      }

      const courseRowSet = courseRowsById.get(row.sourceId);
      if (!courseRowSet || courseRowSet.length === 0) {
        continue;
      }

      courseIds.add(row.sourceId);
      const outline = normalizeGrowthOutline({
        courseSkillIds: courseRowSet[0].outlineVersionCourseSkillIds ?? [],
        chapters: courseRowSet
          .filter((item) => item.nodeType === "chapter")
          .sort(
            (left, right) =>
              left.chapterIndex - right.chapterIndex || left.position - right.position,
          )
          .map((chapterNode) => ({
            title: chapterNode.nodeTitle,
            description: chapterNode.nodeDescription ?? "",
            skillIds: chapterNode.nodeSkillIds ?? [],
            sections: courseRowSet
              .filter(
                (item) => item.nodeType === "section" && item.parentNodeKey === chapterNode.nodeKey,
              )
              .sort(
                (left, right) =>
                  left.chapterIndex - right.chapterIndex || left.position - right.position,
              )
              .map((sectionNode) => ({
                title: sectionNode.nodeTitle,
                description: sectionNode.nodeDescription ?? "",
              })),
          })),
      });
      const progressMap = buildChapterProgressMap(
        outline,
        courseRowSet[0].completedSections ?? [],
        courseRowSet[0].completedChapters ?? [],
      );
      const confidence = Number(row.confidence);
      const rowChapterKeys = linkedRefs
        .filter((ref) => ref.evidenceId === row.evidenceId && ref.refType === "chapter")
        .map((ref) => ref.refId);

      if (rowChapterKeys.length > 0) {
        for (const chapterKey of rowChapterKeys) {
          chapterKeys.add(chapterKey);
          chapterCompletionRatios.push({
            ratio: progressMap.chapterRatios.get(chapterKey) ?? progressMap.courseRatio,
            confidence,
          });
        }
      } else {
        fallbackCourseProgressRatios.push({
          ratio: progressMap.courseRatio,
          confidence,
        });
      }
    }

    const prerequisiteSourceRows = await executor
      .select({
        progress: userSkillNodes.progress,
      })
      .from(userSkillEdges)
      .innerJoin(userSkillNodes, eq(userSkillEdges.fromNodeId, userSkillNodes.id))
      .where(eq(userSkillEdges.toNodeId, nodeId));

    const aggregationInput: AggregationInput = {
      chapterCompletionRatios,
      fallbackCourseProgressRatios,
      courseCount: courseIds.size,
      chapterCount: chapterKeys.size,
      repeatedEvidenceCount: Math.max(0, linkedEvidenceRows.length - courseIds.size),
      prerequisiteProgresses: prerequisiteSourceRows.map((row) => row.progress),
    };

    const progress = computeProgress(aggregationInput);
    const evidenceScore = computeEvidenceScore(aggregationInput);
    const masteryScore = computeMasteryScore(progress, aggregationInput);
    const state = resolveGrowthNodeState(
      progress,
      evidenceScore,
      aggregationInput.prerequisiteProgresses,
    );

    await executor
      .update(userSkillNodes)
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
      .where(eq(userSkillNodes.id, nodeId));
  }
}

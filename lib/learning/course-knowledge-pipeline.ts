import { getUserGrowthContext } from "@/lib/growth/generation-context";
import { computeGrowthOutlineHash, normalizeGrowthOutline } from "@/lib/growth/normalize-outline";
import { enqueueGrowthExtract } from "@/lib/growth/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { buildCourseBlueprintAlignmentBrief } from "@/lib/learning/alignment";
import type { CourseOutline } from "@/lib/learning/course-outline";

export interface CourseKnowledgePipelineResult {
  outlineHash: string;
  extractJobId: string | null;
}

export async function syncCourseOutlineKnowledgePipeline(params: {
  userId: string;
  courseId: string;
  outline: CourseOutline;
}): Promise<CourseKnowledgePipelineResult> {
  const generationContext = await getUserGrowthContext(params.userId);
  const normalizedOutline = normalizeGrowthOutline(params.outline);
  const outlineHash = computeGrowthOutlineHash(normalizedOutline);
  const courseAlignment = buildCourseBlueprintAlignmentBrief({
    courseTitle: params.outline.title,
    courseDescription: params.outline.description,
    courseSkillIds: params.outline.courseSkillIds,
    chapterTitles: params.outline.chapters.map((chapter) => chapter.title),
    chapterSkillIds: params.outline.chapters.flatMap((chapter) => chapter.skillIds ?? []),
    generationContext,
  });

  await ingestEvidenceEvent({
    id: crypto.randomUUID(),
    userId: params.userId,
    kind: "course_outline",
    sourceType: "course",
    sourceId: params.courseId,
    sourceVersionHash: outlineHash,
    title: params.outline.title,
    summary: params.outline.description,
    confidence: 1,
    happenedAt: new Date().toISOString(),
    metadata: {
      chapterCount: normalizedOutline.chapters.length,
      courseSkillIds: normalizedOutline.courseSkillIds,
      generationContext,
      courseAlignment,
      chapterSkillIds: normalizedOutline.chapters.map((chapter) => ({
        chapterKey: chapter.chapterKey,
        skillIds: chapter.explicitSkillIds,
      })),
    },
    refs: normalizedOutline.chapters.map((chapter) => ({
      refType: "chapter",
      refId: chapter.chapterKey,
      snippet: chapter.title,
      weight: 1,
    })),
  });

  const extractJob = await enqueueGrowthExtract(params.userId, params.courseId);

  return {
    outlineHash,
    extractJobId: extractJob.id,
  };
}

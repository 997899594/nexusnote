import { enqueueCareerTreeExtract } from "@/lib/career-tree/queue";
import { computeCareerOutlineHash, normalizeCareerOutline } from "@/lib/career-tree/source";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
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
  const normalizedOutline = normalizeCareerOutline(params.outline);
  const outlineHash = computeCareerOutlineHash(normalizedOutline);

  await ingestEvidenceEvent({
    id: crypto.randomUUID(),
    userId: params.userId,
    kind: "course_outline",
    sourceType: "course",
    sourceId: params.courseId,
    sourceVersionHash: outlineHash,
    title: params.outline.title,
    summary: params.outline.description ?? params.outline.title,
    confidence: 1,
    happenedAt: new Date().toISOString(),
    metadata: {
      chapterCount: normalizedOutline.chapters.length,
      courseSkillIds: normalizedOutline.courseSkillIds,
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

  const extractJob = await enqueueCareerTreeExtract(params.userId, params.courseId);

  return {
    outlineHash,
    extractJobId: extractJob.id,
  };
}

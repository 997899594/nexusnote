import { db } from "@/db";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/generation-runs";
import { GROWTH_AI_MODEL_LABEL } from "@/lib/growth/constants";
import { getCourseForGrowth } from "@/lib/growth/data-access";
import {
  buildGrowthCourseExtractionInput,
  buildGrowthExtractionIdempotencyKey,
  extractGrowthCourseEvidence,
} from "@/lib/growth/extract";
import { computeGrowthOutlineHash, normalizeGrowthOutline } from "@/lib/growth/normalize-outline";
import { enqueueGrowthMerge } from "@/lib/growth/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import {
  aggregateCourseEventsToKnowledgeEvidence,
  listLinkedNodeIdsForEvidenceSource,
} from "@/lib/knowledge/evidence";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";

export async function processGrowthExtractJob(
  job: JobPayload<"extract_course_evidence">,
  options: GrowthJobExecutionOptions = {},
): Promise<void> {
  const { enqueueFollowups = true } = options;
  const course = await getCourseForGrowth(job.userId, job.courseId);
  if (!course) {
    return;
  }

  const outline = normalizeGrowthOutline(course.outline);
  const outlineHash = computeGrowthOutlineHash(outline);
  const idempotencyKey = buildGrowthExtractionIdempotencyKey(job.userId, job.courseId, outlineHash);
  const run = await getOrCreateGenerationRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "extract",
    idempotencyKey,
    inputHash: outlineHash,
    model: GROWTH_AI_MODEL_LABEL,
    promptVersion: "growth-extract@v1",
    reuseCompleted: true,
  });

  if (run.status === "succeeded") {
    if (enqueueFollowups) {
      await enqueueGrowthMerge(job.userId, job.courseId, run.id);
    }
    return;
  }

  try {
    const extracted = await extractGrowthCourseEvidence(
      buildGrowthCourseExtractionInput({
        userId: job.userId,
        courseId: job.courseId,
        title: course.title,
        description: course.description,
        outline,
      }),
    );

    for (const item of extracted.items) {
      await ingestEvidenceEvent({
        id: crypto.randomUUID(),
        userId: job.userId,
        kind: "course_outline",
        sourceType: "course",
        sourceId: job.courseId,
        sourceVersionHash: outlineHash,
        title: item.title,
        summary: item.summary,
        confidence: item.confidence,
        happenedAt: new Date().toISOString(),
        metadata: {
          itemKind: item.kind,
          prerequisiteHints: item.prerequisiteHints,
          relatedHints: item.relatedHints,
        },
        refs: [
          ...item.chapterKeys.map((chapterKey) => ({
            refType: "chapter",
            refId: chapterKey,
            snippet:
              outline.chapters.find((chapter) => chapter.chapterKey === chapterKey)?.title ??
              chapterKey,
            weight: 1,
          })),
          ...item.evidenceSnippets.map((snippet, index) => ({
            refType: "snippet",
            refId: `${item.title}:${index}`,
            snippet,
            weight: 1,
          })),
        ],
      });
    }

    const affectedNodeIds = await listLinkedNodeIdsForEvidenceSource({
      userId: job.userId,
      sourceType: "course",
      sourceId: job.courseId,
    });

    await aggregateCourseEventsToKnowledgeEvidence({
      userId: job.userId,
      courseId: job.courseId,
      sourceVersionHash: outlineHash,
    });

    await markGenerationRunSucceeded(db, run.id, extracted);
    if (enqueueFollowups) {
      await enqueueGrowthMerge(job.userId, job.courseId, run.id, affectedNodeIds);
    }
  } catch (error) {
    await markGenerationRunFailed(run.id, error);
    throw error;
  }
}

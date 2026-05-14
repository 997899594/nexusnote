import { and, eq, sql } from "drizzle-orm";
import { db, knowledgeEvidenceEventRefs, knowledgeEvidenceEvents } from "@/db";
import { GROWTH_AI_MODEL_LABEL, GROWTH_EXTRACT_PROMPT_VERSION } from "@/lib/growth/constants";
import { getCourseForGrowth } from "@/lib/growth/data-access";
import {
  buildGrowthCourseExtractionInput,
  buildGrowthExtractionIdempotencyKey,
  extractGrowthCourseEvidence,
} from "@/lib/growth/extract";
import { computeGrowthOutlineHash, normalizeGrowthOutline } from "@/lib/growth/normalize-outline";
import { enqueueGrowthMerge } from "@/lib/growth/queue";
import { aggregateCourseEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence/aggregate";
import { listLinkedNodeIdsForEvidenceSource } from "@/lib/knowledge/evidence/selectors";
import {
  getOrCreateGenerationRun,
  markGenerationRunFailed,
  markGenerationRunSucceeded,
} from "@/lib/runtime/generation-runs";
import type { GrowthJobExecutionOptions, JobPayload } from "./shared";

async function enqueueMergeIfNeeded(
  job: JobPayload<"extract_course_evidence">,
  runId: string,
  affectedNodeIds: string[] | undefined,
  enqueueFollowups: boolean,
): Promise<void> {
  if (!enqueueFollowups) {
    return;
  }

  await enqueueGrowthMerge(job.userId, job.courseId, runId, affectedNodeIds);
}

function buildEvidenceRefs(params: {
  item: {
    title: string;
    chapterKeys: string[];
    evidenceSnippets: string[];
  };
  outline: ReturnType<typeof normalizeGrowthOutline>;
}) {
  const chapterTitleByKey = new Map(
    params.outline.chapters.map((chapter) => [chapter.chapterKey, chapter.title]),
  );

  return [
    ...params.item.chapterKeys.map((chapterKey) => ({
      refType: "chapter",
      refId: chapterKey,
      snippet: chapterTitleByKey.get(chapterKey) ?? chapterKey,
      weight: 1,
    })),
    ...params.item.evidenceSnippets.map((snippet, index) => ({
      refType: "snippet",
      refId: `${params.item.title}:${index}`,
      snippet,
      weight: 1,
    })),
  ];
}

async function replaceExtractedCourseEvidenceEvents(params: {
  userId: string;
  courseId: string;
  outlineHash: string;
  extracted: Awaited<ReturnType<typeof extractGrowthCourseEvidence>>;
  outline: ReturnType<typeof normalizeGrowthOutline>;
}): Promise<void> {
  const happenedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(knowledgeEvidenceEvents)
      .where(
        and(
          eq(knowledgeEvidenceEvents.userId, params.userId),
          eq(knowledgeEvidenceEvents.sourceType, "course"),
          eq(knowledgeEvidenceEvents.sourceId, params.courseId),
          eq(knowledgeEvidenceEvents.sourceVersionHash, params.outlineHash),
          sql`${knowledgeEvidenceEvents.metadata} ? 'itemKind'`,
        ),
      );

    const events = params.extracted.items.map((item) => ({
      id: crypto.randomUUID(),
      item,
      refs: buildEvidenceRefs({ item, outline: params.outline }),
    }));

    if (events.length === 0) {
      return;
    }

    await tx.insert(knowledgeEvidenceEvents).values(
      events.map(({ id, item }) => ({
        id,
        userId: params.userId,
        kind: "course_outline",
        sourceType: "course",
        sourceId: params.courseId,
        sourceVersionHash: params.outlineHash,
        title: item.title,
        summary: item.summary,
        confidence: item.confidence.toFixed(3),
        happenedAt,
        metadata: {
          itemKind: item.kind,
          prerequisiteHints: item.prerequisiteHints,
          relatedHints: item.relatedHints,
          promptVersion: GROWTH_EXTRACT_PROMPT_VERSION,
        },
      })),
    );

    const refs = events.flatMap(({ id, refs }) =>
      refs.map((ref) => ({
        eventId: id,
        refType: ref.refType,
        refId: ref.refId,
        snippet: ref.snippet ?? null,
        weight: ref.weight.toFixed(3),
      })),
    );

    if (refs.length > 0) {
      await tx.insert(knowledgeEvidenceEventRefs).values(refs);
    }
  });
}

function validateExtractedCourseEvidence(
  extracted: Awaited<ReturnType<typeof extractGrowthCourseEvidence>>,
  outline: ReturnType<typeof normalizeGrowthOutline>,
): void {
  if (extracted.items.length === 0) {
    throw new Error("Growth course extraction returned no evidence items");
  }

  const validChapterKeys = new Set(outline.chapters.map((chapter) => chapter.chapterKey));
  const invalidRefs = extracted.items.flatMap((item) =>
    item.chapterKeys
      .filter((chapterKey) => !validChapterKeys.has(chapterKey))
      .map((chapterKey) => `${item.title}:${chapterKey}`),
  );
  if (invalidRefs.length > 0) {
    throw new Error(
      `Growth course extraction returned invalid chapter refs: ${invalidRefs.join(", ")}`,
    );
  }

  const duplicateChapterRefs = extracted.items.flatMap((item) => {
    const seen = new Set<string>();
    return item.chapterKeys
      .filter((chapterKey) => {
        if (seen.has(chapterKey)) {
          return true;
        }

        seen.add(chapterKey);
        return false;
      })
      .map((chapterKey) => `${item.title}:${chapterKey}`);
  });
  if (duplicateChapterRefs.length > 0) {
    throw new Error(
      `Growth course extraction returned duplicate chapter refs: ${duplicateChapterRefs.join(", ")}`,
    );
  }
}

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
    promptVersion: GROWTH_EXTRACT_PROMPT_VERSION,
    reuseCompleted: true,
  });

  if (run.status === "succeeded") {
    await enqueueMergeIfNeeded(job, run.id, undefined, enqueueFollowups);
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
    validateExtractedCourseEvidence(extracted, outline);
    await replaceExtractedCourseEvidenceEvents({
      userId: job.userId,
      courseId: job.courseId,
      outlineHash,
      extracted,
      outline,
    });

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
    await enqueueMergeIfNeeded(job, run.id, affectedNodeIds, enqueueFollowups);
  } catch (error) {
    await markGenerationRunFailed(run.id, error);
    throw error;
  }
}

import type { Worker } from "bullmq";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { defaults } from "@/config/env";
import { db, domainOutboxEvents } from "@/db";
import { enqueueCareerTreeRefresh } from "@/lib/career-tree/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateCourseEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence/aggregate";
import { syncCourseOutlineKnowledgePipeline } from "@/lib/learning/course-knowledge-pipeline";
import { CourseOutlineSchema } from "@/lib/learning/course-outline";
import { LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";
import { createNexusWorker } from "@/lib/queue/bullmq";
import { getLearningOutboxQueue, type LearningOutboxJobData } from "./learning-outbox-queue";

const courseRevisionPayloadSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  outlineVersionId: z.string().uuid(),
  outline: CourseOutlineSchema,
});

const sectionCompletedPayloadSchema = z.object({
  activityEventId: z.string().uuid(),
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  publicationId: z.string().uuid().optional(),
  snapshotId: z.string().uuid().optional(),
  outlineVersionId: z.string().uuid(),
  sourceVersionHash: z.string().min(1),
  courseTitle: z.string().min(1),
  sectionId: z.string().uuid(),
  sectionTitle: z.string().min(1),
  chapterId: z.string().uuid().optional(),
  chapterTitle: z.string().min(1),
  completedSectionCount: z.number().int().nonnegative(),
  totalSectionCount: z.number().int().positive(),
});

let worker: Worker<LearningOutboxJobData> | null = null;
let dispatchTimer: ReturnType<typeof setInterval> | null = null;
let dispatching = false;

async function dispatchPendingEvents(): Promise<void> {
  if (dispatching) return;
  dispatching = true;
  try {
    const events = await db
      .select({ id: domainOutboxEvents.id })
      .from(domainOutboxEvents)
      .where(
        and(
          isNull(domainOutboxEvents.processedAt),
          lte(domainOutboxEvents.availableAt, new Date()),
        ),
      )
      .orderBy(asc(domainOutboxEvents.createdAt))
      .limit(100);

    for (const event of events) {
      await getLearningOutboxQueue().add(
        "dispatch",
        { eventId: event.id },
        { jobId: `learning-outbox-${event.id}` },
      );
    }
  } finally {
    dispatching = false;
  }
}

async function processOutboxEvent(eventId: string): Promise<void> {
  const [event] = await db
    .select()
    .from(domainOutboxEvents)
    .where(eq(domainOutboxEvents.id, eventId))
    .limit(1);
  if (!event || event.processedAt) return;

  try {
    if (event.topic === LEARNING_OUTBOX_TOPICS.courseRevisionCreated) {
      const payload = courseRevisionPayloadSchema.parse(event.payload);
      await syncCourseOutlineKnowledgePipeline({
        userId: payload.userId,
        courseId: payload.courseId,
        outline: payload.outline,
        eventId: event.id,
        requestKey: `outbox:${event.id}`,
      });
    } else if (event.topic === LEARNING_OUTBOX_TOPICS.sectionCompleted) {
      const payload = sectionCompletedPayloadSchema.parse(event.payload);
      await ingestEvidenceEvent({
        id: payload.activityEventId,
        userId: payload.userId,
        kind: "course_progress",
        sourceType: "course",
        sourceId: payload.courseId,
        sourceVersionHash: payload.sourceVersionHash,
        title: payload.courseTitle,
        summary: `完成了《${payload.sectionTitle}》`,
        confidence: 1,
        happenedAt: event.createdAt.toISOString(),
        metadata: {
          publicationId: payload.publicationId,
          snapshotId: payload.snapshotId,
          outlineVersionId: payload.outlineVersionId,
          sectionNodeId: payload.sectionId,
          completedSectionCount: payload.completedSectionCount,
        },
        refs: [
          {
            refType: "section",
            refId: payload.sectionId,
            snippet: payload.sectionTitle,
            weight: 1,
          },
          ...(payload.chapterId
            ? [
                {
                  refType: "chapter",
                  refId: payload.chapterId,
                  snippet: payload.chapterTitle,
                  weight: 1,
                },
              ]
            : []),
        ],
      });
      await aggregateCourseEventsToKnowledgeEvidence({
        userId: payload.userId,
        courseId: payload.courseId,
        sourceVersionHash: payload.sourceVersionHash,
      });
      await enqueueCareerTreeRefresh({
        userId: payload.userId,
        courseId: payload.courseId,
        reasonKey: `learning-outbox:${event.id}`,
        requestKey: `outbox:${event.id}`,
      });
    } else {
      throw new Error(`Unsupported learning outbox topic: ${event.topic}`);
    }

    await db
      .update(domainOutboxEvents)
      .set({ processedAt: new Date(), lastError: null })
      .where(eq(domainOutboxEvents.id, event.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown outbox processing error";
    await db
      .update(domainOutboxEvents)
      .set({
        attemptCount: sql`${domainOutboxEvents.attemptCount} + 1`,
        availableAt: new Date(Date.now() + 30_000),
        lastError: message.slice(0, 2000),
      })
      .where(eq(domainOutboxEvents.id, event.id));
    throw error;
  }
}

export function startLearningOutboxWorker() {
  if (worker) return worker;

  worker = createNexusWorker<LearningOutboxJobData>(
    "learning-outbox",
    async (job) => processOutboxEvent(job.data.eventId),
    {
      label: "LearningOutboxWorker",
      concurrency: defaults.queue.learningOutboxConcurrency,
    },
  );

  dispatchTimer = setInterval(() => {
    void dispatchPendingEvents().catch((error) => {
      console.error("[LearningOutboxWorker] Dispatch failed", error);
    });
  }, 2_000);
  void dispatchPendingEvents().catch((error) => {
    console.error("[LearningOutboxWorker] Initial dispatch failed", error);
  });

  worker.on("failed", (job) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    setTimeout(() => {
      void job.remove().catch((error) => {
        console.error("[LearningOutboxWorker] Failed to release exhausted job", error);
      });
    }, 1_000);
  });

  const baseClose = worker.close.bind(worker);
  worker.close = async (force?: boolean) => {
    if (dispatchTimer) clearInterval(dispatchTimer);
    dispatchTimer = null;
    return baseClose(force);
  };
  return worker;
}

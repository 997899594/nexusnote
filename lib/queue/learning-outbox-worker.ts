import type { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type DomainOutboxEvent, db, domainOutboxEvents } from "@/db";
import {
  type ProductLearningActivityPayload,
  ProductLearningActivityPayloadSchema,
} from "@/lib/analytics/product-analytics";
import { enqueueCareerTreeRefresh } from "@/lib/career-tree/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateCourseEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence/aggregate";
import { refreshLearningActivationProjection } from "@/lib/learning/activation-projection";
import { syncCourseOutlineKnowledgePipeline } from "@/lib/learning/course-knowledge-pipeline";
import { CourseOutlineSchema } from "@/lib/learning/course-outline";
import { appendLearningOutboxEvent, LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";
import { recordOutboxDeliveryMetric } from "@/lib/observability/metrics";
import { buildErrorLogFields, writeStructuredLog } from "@/lib/observability/structured-log";
import { createNexusWorker } from "@/lib/queue/bullmq";
import { listPendingOutboxEventIds } from "@/lib/queue/outbox-dispatch";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";
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

const CRITICAL_OUTBOX_TOPICS = [
  LEARNING_OUTBOX_TOPICS.courseRevisionCreated,
  LEARNING_OUTBOX_TOPICS.sectionCompleted,
  LEARNING_OUTBOX_TOPICS.activityRecorded,
] as const;

async function dispatchPendingEvents(): Promise<void> {
  if (dispatching) return;
  dispatching = true;
  try {
    const eventIds = await listPendingOutboxEventIds(CRITICAL_OUTBOX_TOPICS, 100);
    for (const eventId of eventIds) {
      await getLearningOutboxQueue().add(
        "dispatch",
        { eventId },
        { jobId: `learning-outbox-${eventId}` },
      );
    }
  } finally {
    dispatching = false;
  }
}

async function projectActivityAndEnqueueAnalytics(
  event: DomainOutboxEvent,
  payload: ProductLearningActivityPayload,
): Promise<void> {
  await db.transaction(async (tx) => {
    await refreshLearningActivationProjection(
      { userId: payload.userId, courseId: payload.courseId },
      tx,
    );
    await appendLearningOutboxEvent(tx, {
      topic: LEARNING_OUTBOX_TOPICS.analyticsLearningActivityRecorded,
      aggregateType: "learning_activity",
      aggregateId: payload.eventId,
      payload,
    });
    await tx
      .update(domainOutboxEvents)
      .set({ processedAt: new Date(), lastAttemptAt: new Date(), lastError: null })
      .where(eq(domainOutboxEvents.id, event.id));
  });
}

async function processOutboxEvent(eventId: string): Promise<void> {
  const policy = getQueueRuntimePolicy("learningOutbox");
  const [event] = await db
    .select()
    .from(domainOutboxEvents)
    .where(eq(domainOutboxEvents.id, eventId))
    .limit(1);
  if (!event || event.processedAt || event.deadLetteredAt) return;

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
    } else if (event.topic === LEARNING_OUTBOX_TOPICS.activityRecorded) {
      const payload = ProductLearningActivityPayloadSchema.parse(event.payload);
      await projectActivityAndEnqueueAnalytics(event, payload);
      recordOutboxDeliveryMetric({
        lane: "critical",
        topic: event.topic,
        outcome: "processed",
        durationMs: Date.now() - event.createdAt.getTime(),
      });
      return;
    } else {
      throw new Error(`Unsupported learning outbox topic: ${event.topic}`);
    }

    await db
      .update(domainOutboxEvents)
      .set({ processedAt: new Date(), lastAttemptAt: new Date(), lastError: null })
      .where(eq(domainOutboxEvents.id, event.id));
    recordOutboxDeliveryMetric({
      lane: "critical",
      topic: event.topic,
      outcome: "processed",
      durationMs: Date.now() - event.createdAt.getTime(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown outbox processing error";
    const nextAttemptCount = event.attemptCount + 1;
    const deadLettered = nextAttemptCount >= policy.attempts;
    const retryDelay = Math.min(
      policy.backoffDelay * 2 ** Math.max(0, nextAttemptCount - 1),
      15 * 60 * 1000,
    );
    const now = new Date();
    await db
      .update(domainOutboxEvents)
      .set({
        attemptCount: sql`${domainOutboxEvents.attemptCount} + 1`,
        availableAt: new Date(now.getTime() + retryDelay),
        lastAttemptAt: now,
        deadLetteredAt: deadLettered ? now : null,
        lastError: message.slice(0, 2000),
      })
      .where(eq(domainOutboxEvents.id, event.id));

    writeStructuredLog(deadLettered ? "error" : "warn", "learning_outbox_delivery_failed", {
      eventId: event.id,
      topic: event.topic,
      attemptCount: nextAttemptCount,
      deadLettered,
      retryDelayMs: deadLettered ? null : retryDelay,
      ...buildErrorLogFields(error),
    });
    recordOutboxDeliveryMetric({
      lane: "critical",
      topic: event.topic,
      outcome: deadLettered ? "dead_lettered" : "failed",
      durationMs: Date.now() - event.createdAt.getTime(),
    });
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
      concurrency: getQueueRuntimePolicy("learningOutbox").concurrency,
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

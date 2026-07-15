import type { Worker } from "bullmq";
import { eq, inArray, sql } from "drizzle-orm";
import { type DomainOutboxEvent, db, domainOutboxEvents } from "@/db";
import {
  mirrorLearningActivitiesToPostHog,
  ProductLearningActivityPayloadSchema,
} from "@/lib/analytics/product-analytics";
import { LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";
import { recordOutboxDeliveryMetric } from "@/lib/observability/metrics";
import { buildErrorLogFields, writeStructuredLog } from "@/lib/observability/structured-log";
import {
  type AnalyticsOutboxJobData,
  getAnalyticsOutboxQueue,
} from "@/lib/queue/analytics-outbox-queue";
import { createNexusWorker } from "@/lib/queue/bullmq";
import { buildSafeJobId } from "@/lib/queue/job-id";
import { listPendingOutboxEventIds } from "@/lib/queue/outbox-dispatch";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";

const DISPATCH_LIMIT = 500;
const DELIVERY_BATCH_SIZE = 50;

let worker: Worker<AnalyticsOutboxJobData> | null = null;
let dispatchTimer: ReturnType<typeof setInterval> | null = null;
let dispatching = false;

function chunkEventIds(eventIds: string[]): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < eventIds.length; index += DELIVERY_BATCH_SIZE) {
    batches.push(eventIds.slice(index, index + DELIVERY_BATCH_SIZE));
  }
  return batches;
}

async function dispatchPendingEvents(): Promise<void> {
  if (dispatching) return;
  dispatching = true;
  try {
    const eventIds = await listPendingOutboxEventIds(
      [LEARNING_OUTBOX_TOPICS.analyticsLearningActivityRecorded],
      DISPATCH_LIMIT,
    );
    for (const batch of chunkEventIds(eventIds)) {
      await getAnalyticsOutboxQueue().add(
        "deliver-batch",
        { eventIds: batch },
        { jobId: buildSafeJobId(["analytics-outbox", ...batch]) },
      );
    }
  } finally {
    dispatching = false;
  }
}

async function markInvalidEvent(event: DomainOutboxEvent, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Invalid analytics outbox payload";
  const now = new Date();
  await db
    .update(domainOutboxEvents)
    .set({
      attemptCount: sql`${domainOutboxEvents.attemptCount} + 1`,
      lastAttemptAt: now,
      deadLetteredAt: now,
      lastError: message.slice(0, 2000),
    })
    .where(eq(domainOutboxEvents.id, event.id));
  writeStructuredLog("error", "analytics_outbox_payload_rejected", {
    eventId: event.id,
    topic: event.topic,
    ...buildErrorLogFields(error),
  });
  recordOutboxDeliveryMetric({
    lane: "analytics",
    topic: event.topic,
    outcome: "dead_lettered",
    durationMs: Date.now() - event.createdAt.getTime(),
  });
}

async function markDeliveryFailure(events: DomainOutboxEvent[], error: unknown): Promise<void> {
  const policy = getQueueRuntimePolicy("analyticsOutbox");
  const message = error instanceof Error ? error.message : "Unknown analytics delivery error";
  const now = new Date();
  const outcomes = events.map((event) => {
    const nextAttemptCount = event.attemptCount + 1;
    const deadLettered = nextAttemptCount >= policy.attempts;
    return {
      event,
      deadLettered,
      retryDelay: Math.min(
        policy.backoffDelay * 2 ** Math.max(0, nextAttemptCount - 1),
        15 * 60 * 1000,
      ),
    };
  });

  await db.transaction(async (tx) => {
    for (const { event, deadLettered, retryDelay } of outcomes) {
      await tx
        .update(domainOutboxEvents)
        .set({
          attemptCount: sql`${domainOutboxEvents.attemptCount} + 1`,
          availableAt: new Date(now.getTime() + retryDelay),
          lastAttemptAt: now,
          deadLetteredAt: deadLettered ? now : null,
          lastError: message.slice(0, 2000),
        })
        .where(eq(domainOutboxEvents.id, event.id));
    }
  });

  for (const { event, deadLettered } of outcomes) {
    recordOutboxDeliveryMetric({
      lane: "analytics",
      topic: event.topic,
      outcome: deadLettered ? "dead_lettered" : "failed",
      durationMs: Date.now() - event.createdAt.getTime(),
    });
  }

  writeStructuredLog("warn", "analytics_outbox_delivery_failed", {
    eventIds: events.map((event) => event.id),
    eventCount: events.length,
    ...buildErrorLogFields(error),
  });
}

async function processAnalyticsBatch(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;

  const events = await db
    .select()
    .from(domainOutboxEvents)
    .where(inArray(domainOutboxEvents.id, eventIds));
  const pendingEvents = events.filter(
    (event) =>
      event.topic === LEARNING_OUTBOX_TOPICS.analyticsLearningActivityRecorded &&
      !event.processedAt &&
      !event.deadLetteredAt,
  );
  const validEvents: DomainOutboxEvent[] = [];
  const payloads = [];

  for (const event of pendingEvents) {
    const parsed = ProductLearningActivityPayloadSchema.safeParse(event.payload);
    if (!parsed.success) {
      await markInvalidEvent(event, parsed.error);
      continue;
    }
    validEvents.push(event);
    payloads.push(parsed.data);
  }

  if (validEvents.length === 0) return;

  try {
    await mirrorLearningActivitiesToPostHog(payloads);
    const now = new Date();
    await db
      .update(domainOutboxEvents)
      .set({ processedAt: now, lastAttemptAt: now, lastError: null })
      .where(
        inArray(
          domainOutboxEvents.id,
          validEvents.map((event) => event.id),
        ),
      );
    for (const event of validEvents) {
      recordOutboxDeliveryMetric({
        lane: "analytics",
        topic: event.topic,
        outcome: "processed",
        durationMs: Date.now() - event.createdAt.getTime(),
      });
    }
  } catch (error) {
    await markDeliveryFailure(validEvents, error);
    throw error;
  }
}

export function startAnalyticsOutboxWorker() {
  if (worker) return worker;

  worker = createNexusWorker<AnalyticsOutboxJobData>(
    "analytics-outbox",
    async (job) => processAnalyticsBatch(job.data.eventIds),
    {
      label: "AnalyticsOutboxWorker",
      concurrency: getQueueRuntimePolicy("analyticsOutbox").concurrency,
    },
  );

  dispatchTimer = setInterval(() => {
    void dispatchPendingEvents().catch((error) => {
      console.error("[AnalyticsOutboxWorker] Dispatch failed", error);
    });
  }, 2_000);
  void dispatchPendingEvents().catch((error) => {
    console.error("[AnalyticsOutboxWorker] Initial dispatch failed", error);
  });

  worker.on("failed", (job) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    setTimeout(() => {
      void job.remove().catch((error) => {
        console.error("[AnalyticsOutboxWorker] Failed to release exhausted job", error);
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

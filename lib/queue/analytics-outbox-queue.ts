import type { Queue } from "bullmq";
import { createNexusQueue } from "@/lib/queue/bullmq";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";

export interface AnalyticsOutboxJobData {
  eventIds: string[];
}

let analyticsOutboxQueue: Queue<AnalyticsOutboxJobData> | null = null;

export function getAnalyticsOutboxQueue(): Queue<AnalyticsOutboxJobData> {
  if (analyticsOutboxQueue) return analyticsOutboxQueue;

  analyticsOutboxQueue = createNexusQueue<AnalyticsOutboxJobData>(
    "analytics-outbox",
    getQueueRuntimePolicy("analyticsOutbox"),
  );
  return analyticsOutboxQueue;
}

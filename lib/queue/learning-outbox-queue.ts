import type { Queue } from "bullmq";
import { env } from "@/config/env";
import { createNexusQueue } from "@/lib/queue/bullmq";

export interface LearningOutboxJobData {
  eventId: string;
}

let learningOutboxQueue: Queue<LearningOutboxJobData> | null = null;

export function getLearningOutboxQueue(): Queue<LearningOutboxJobData> {
  if (learningOutboxQueue) return learningOutboxQueue;

  learningOutboxQueue = createNexusQueue<LearningOutboxJobData>("learning-outbox", {
    attempts: env.QUEUE_LEARNING_OUTBOX_MAX_RETRIES,
    backoffDelay: env.QUEUE_LEARNING_OUTBOX_BACKOFF_DELAY,
  });
  return learningOutboxQueue;
}

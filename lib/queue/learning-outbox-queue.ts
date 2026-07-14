import type { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { createNexusQueue } from "@/lib/queue/bullmq";

export interface LearningOutboxJobData {
  eventId: string;
}

let learningOutboxQueue: Queue<LearningOutboxJobData> | null = null;

export function getLearningOutboxQueue(): Queue<LearningOutboxJobData> {
  if (learningOutboxQueue) return learningOutboxQueue;

  learningOutboxQueue = createNexusQueue<LearningOutboxJobData>("learning-outbox", {
    attempts: defaults.queue.learningOutboxMaxRetries,
    backoffDelay: defaults.queue.learningOutboxBackoffDelay,
  });
  return learningOutboxQueue;
}

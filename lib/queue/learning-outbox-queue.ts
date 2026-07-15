import type { Queue } from "bullmq";
import { createNexusQueue } from "@/lib/queue/bullmq";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";

export interface LearningOutboxJobData {
  eventId: string;
}

let learningOutboxQueue: Queue<LearningOutboxJobData> | null = null;

export function getLearningOutboxQueue(): Queue<LearningOutboxJobData> {
  if (learningOutboxQueue) return learningOutboxQueue;

  learningOutboxQueue = createNexusQueue<LearningOutboxJobData>(
    "learning-outbox",
    getQueueRuntimePolicy("learningOutbox"),
  );
  return learningOutboxQueue;
}

import { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { getRedis } from "@/lib/redis";

export type KnowledgeInsightsQueueJobData = {
  type: "derive_user_insights";
  userId: string;
};

let knowledgeInsightsQueue: Queue<KnowledgeInsightsQueueJobData> | null = null;

export function getKnowledgeInsightsQueue(): Queue<KnowledgeInsightsQueueJobData> {
  if (knowledgeInsightsQueue) {
    return knowledgeInsightsQueue;
  }

  knowledgeInsightsQueue = new Queue<KnowledgeInsightsQueueJobData>("knowledge-insights", {
    connection: getRedis() as never,
    defaultJobOptions: {
      attempts: defaults.queue.knowledgeInsightsMaxRetries,
      backoff: {
        type: "exponential",
        delay: defaults.queue.knowledgeInsightsBackoffDelay,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return knowledgeInsightsQueue;
}

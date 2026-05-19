import type { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { createNexusQueue } from "@/lib/queue/bullmq";

export type KnowledgeInsightsQueueJobData = {
  type: "derive_user_insights";
  userId: string;
};

let knowledgeInsightsQueue: Queue<KnowledgeInsightsQueueJobData> | null = null;

export function getKnowledgeInsightsQueue(): Queue<KnowledgeInsightsQueueJobData> {
  if (knowledgeInsightsQueue) {
    return knowledgeInsightsQueue;
  }

  knowledgeInsightsQueue = createNexusQueue<KnowledgeInsightsQueueJobData>("knowledge-insights", {
    attempts: defaults.queue.knowledgeInsightsMaxRetries,
    backoffDelay: defaults.queue.knowledgeInsightsBackoffDelay,
  });

  return knowledgeInsightsQueue;
}

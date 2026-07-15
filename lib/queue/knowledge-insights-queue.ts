import type { Queue } from "bullmq";
import { createNexusQueue } from "@/lib/queue/bullmq";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";

export type KnowledgeInsightsQueueJobData = {
  type: "derive_user_insights";
  userId: string;
};

let knowledgeInsightsQueue: Queue<KnowledgeInsightsQueueJobData> | null = null;

export function getKnowledgeInsightsQueue(): Queue<KnowledgeInsightsQueueJobData> {
  if (knowledgeInsightsQueue) {
    return knowledgeInsightsQueue;
  }

  knowledgeInsightsQueue = createNexusQueue<KnowledgeInsightsQueueJobData>(
    "knowledge-insights",
    getQueueRuntimePolicy("knowledgeInsights"),
  );

  return knowledgeInsightsQueue;
}

import type { Worker } from "bullmq";
import { processKnowledgeInsightsJob } from "@/lib/knowledge/insights/jobs";
import { createNexusWorker } from "./bullmq";
import type { KnowledgeInsightsQueueJobData } from "./knowledge-insights-queue";
import { getQueueRuntimePolicy } from "./runtime-policy";

let worker: Worker<KnowledgeInsightsQueueJobData> | null = null;

export function startKnowledgeInsightsWorker(): Worker<KnowledgeInsightsQueueJobData> {
  if (worker) {
    return worker;
  }

  worker = createNexusWorker<KnowledgeInsightsQueueJobData>(
    "knowledge-insights",
    async (job) => {
      switch (job.data.type) {
        case "derive_user_insights":
          await processKnowledgeInsightsJob(job.data);
          break;
      }
    },
    {
      label: "KnowledgeInsightsWorker",
      concurrency: getQueueRuntimePolicy("knowledgeInsights").concurrency,
    },
  );
  return worker;
}

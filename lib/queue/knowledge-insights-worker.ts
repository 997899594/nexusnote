import { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { processKnowledgeInsightsJob } from "@/lib/knowledge/insights/jobs";
import { getRedis } from "@/lib/redis";
import type { KnowledgeInsightsQueueJobData } from "./knowledge-insights-queue";

let worker: Worker<KnowledgeInsightsQueueJobData> | null = null;

export function startKnowledgeInsightsWorker(): Worker<KnowledgeInsightsQueueJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<KnowledgeInsightsQueueJobData>(
    "knowledge-insights",
    async (job) => {
      switch (job.data.type) {
        case "derive_user_insights":
          await processKnowledgeInsightsJob(job.data);
          break;
      }
    },
    {
      connection: getRedis() as never,
      concurrency: defaults.queue.knowledgeInsightsConcurrency,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[KnowledgeInsightsWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[KnowledgeInsightsWorker] Failed: ${job?.id}`, err.message);
  });

  console.log(
    "[KnowledgeInsightsWorker] Started with concurrency:",
    defaults.queue.knowledgeInsightsConcurrency,
  );
  return worker;
}

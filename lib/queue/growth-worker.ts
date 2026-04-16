import { Worker } from "bullmq";
import {
  processGrowthComposeJob,
  processGrowthExtractJob,
  processGrowthMergeJob,
  processGrowthProjectionJob,
  processGrowthRefreshJob,
  processKnowledgeSourceMergeJob,
} from "@/lib/growth/jobs";
import { processKnowledgeInsightsJob } from "@/lib/knowledge/insights/jobs";
import { redis } from "@/lib/redis";
import type { GrowthJobData } from "./growth-queue";

let worker: Worker<GrowthJobData> | null = null;

export function startGrowthWorker(): Worker<GrowthJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<GrowthJobData>(
    "growth",
    async (job) => {
      switch (job.data.type) {
        case "extract_course_evidence":
          await processGrowthExtractJob(job.data);
          break;
        case "merge_user_skill_graph":
          await processGrowthMergeJob(job.data);
          break;
        case "merge_knowledge_source_evidence":
          await processKnowledgeSourceMergeJob(job.data);
          break;
        case "compose_user_growth_snapshot":
          await processGrowthComposeJob(job.data);
          break;
        case "project_user_growth_views":
          await processGrowthProjectionJob(job.data);
          break;
        case "refresh_user_skill_graph":
          await processGrowthRefreshJob(job.data);
          break;
        case "derive_user_insights":
          await processKnowledgeInsightsJob(job.data);
          break;
      }
    },
    {
      connection: redis as never,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[GrowthWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[GrowthWorker] Failed: ${job?.id}`, err.message);
  });

  return worker;
}

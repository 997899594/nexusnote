import { Worker } from "bullmq";
import {
  processCareerTreeComposeJob,
  processCareerTreeExtractJob,
  processCareerTreeMergeJob,
  processCareerTreeRefreshJob,
  processKnowledgeSourceMergeJob,
} from "@/lib/career-tree/jobs";
import { processKnowledgeInsightsJob } from "@/lib/knowledge/insights/jobs";
import { redis } from "@/lib/redis";
import type { CareerTreeJobData } from "./career-tree-queue";

let worker: Worker<CareerTreeJobData> | null = null;

export function startCareerTreeWorker(): Worker<CareerTreeJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<CareerTreeJobData>(
    "career-tree",
    async (job) => {
      switch (job.data.type) {
        case "extract_course_evidence":
          await processCareerTreeExtractJob(job.data);
          break;
        case "merge_user_skill_graph":
          await processCareerTreeMergeJob(job.data);
          break;
        case "merge_knowledge_source_evidence":
          await processKnowledgeSourceMergeJob(job.data);
          break;
        case "compose_user_career_trees":
          await processCareerTreeComposeJob(job.data);
          break;
        case "refresh_user_skill_graph":
          await processCareerTreeRefreshJob(job.data);
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
    console.log(`[CareerTreeWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[CareerTreeWorker] Failed: ${job?.id}`, err.message);
  });

  return worker;
}

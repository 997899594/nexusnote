import { Worker } from "bullmq";
import { defaults } from "@/config/env";
import {
  recomputeAllCareerNodeAggregatesForUser,
  recomputeCareerNodesForCourse,
} from "@/lib/career-tree/aggregation";
import { processCareerTreeComposeJob } from "@/lib/career-tree/compose";
import { processCareerTreeExtractJob } from "@/lib/career-tree/extract";
import { processCareerTreeMergeJob } from "@/lib/career-tree/merge";
import { enqueueCareerTreeCompose } from "@/lib/career-tree/queue";
import { getRedis } from "@/lib/redis";
import type { CareerTreeJobData } from "./career-tree-queue";

let worker: Worker<CareerTreeJobData> | null = null;

async function processCareerTreeRefreshJob(
  job: Extract<CareerTreeJobData, { type: "refresh_user_career_tree_snapshot" }>,
): Promise<void> {
  if (job.courseId) {
    await recomputeCareerNodesForCourse({
      userId: job.userId,
      courseId: job.courseId,
    });
  } else {
    await recomputeAllCareerNodeAggregatesForUser(job.userId);
  }

  await enqueueCareerTreeCompose(job.userId);
}

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
        case "compose_user_career_trees":
          await processCareerTreeComposeJob(job.data);
          break;
        case "refresh_user_career_tree_snapshot":
          await processCareerTreeRefreshJob(job.data);
          break;
      }
    },
    {
      connection: getRedis() as never,
      concurrency: defaults.queue.careerTreeConcurrency,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[CareerTreeWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[CareerTreeWorker] Failed: ${job?.id}`, err.message);
  });

  console.log("[CareerTreeWorker] Started with concurrency:", defaults.queue.careerTreeConcurrency);

  return worker;
}

import { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { materializeCourseSectionInBackground } from "@/lib/ai/workflows/course-section-production";
import { getRedis } from "@/lib/redis";
import type { CourseProductionJobData } from "./course-production-queue";

let worker: Worker<CourseProductionJobData> | null = null;

export function startCourseProductionWorker(): Worker<CourseProductionJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<CourseProductionJobData>(
    "course-production",
    async (job) => {
      switch (job.data.type) {
        case "materialize_section":
          await materializeCourseSectionInBackground(job.data);
          break;
      }
    },
    {
      connection: getRedis() as never,
      concurrency: defaults.queue.courseProductionConcurrency,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[CourseProductionWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[CourseProductionWorker] Failed: ${job?.id}`, err.message);
  });

  console.log(
    "[CourseProductionWorker] Started with concurrency:",
    defaults.queue.courseProductionConcurrency,
  );

  return worker;
}

import type { Worker } from "bullmq";
import { materializeCourseSectionInBackground } from "@/lib/ai/workflows/course-section-production";
import { createNexusWorker } from "./bullmq";
import type { CourseProductionJobData } from "./course-production-queue";
import { getQueueRuntimePolicy } from "./runtime-policy";

let worker: Worker<CourseProductionJobData> | null = null;

export function startCourseProductionWorker(): Worker<CourseProductionJobData> {
  if (worker) {
    return worker;
  }

  worker = createNexusWorker<CourseProductionJobData>(
    "course-production",
    async (job) => {
      switch (job.data.type) {
        case "materialize_section":
          await materializeCourseSectionInBackground(job.data, {
            attemptNumber: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts ?? 1,
          });
          break;
      }
    },
    {
      label: "CourseProductionWorker",
      concurrency: getQueueRuntimePolicy("courseProduction").concurrency,
    },
  );

  return worker;
}

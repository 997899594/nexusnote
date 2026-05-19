import type { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { materializeCourseSectionInBackground } from "@/lib/ai/workflows/course-section-production";
import { createNexusWorker } from "./bullmq";
import type { CourseProductionJobData } from "./course-production-queue";

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
          await materializeCourseSectionInBackground(job.data);
          break;
      }
    },
    {
      label: "CourseProductionWorker",
      concurrency: defaults.queue.courseProductionConcurrency,
    },
  );

  return worker;
}

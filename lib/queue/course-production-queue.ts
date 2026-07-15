import type { Queue } from "bullmq";
import { createNexusQueue } from "@/lib/queue/bullmq";
import { buildSafeJobId } from "@/lib/queue/job-id";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";

export type CourseProductionJobData = {
  type: "materialize_section";
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  reasonKey: string;
};

export interface QueuedCourseProductionJob {
  id: string | null;
  name: string;
  type: CourseProductionJobData["type"];
}

export interface CourseProductionJobSnapshot {
  id: string;
  state: string;
}

let courseProductionQueue: Queue<CourseProductionJobData> | null = null;

export function getCourseProductionQueue(): Queue<CourseProductionJobData> {
  if (courseProductionQueue) {
    return courseProductionQueue;
  }

  courseProductionQueue = createNexusQueue<CourseProductionJobData>(
    "course-production",
    getQueueRuntimePolicy("courseProduction"),
  );

  return courseProductionQueue;
}

function buildSectionJobId(params: {
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
}) {
  return buildSafeJobId([
    "course-section",
    params.courseId,
    params.chapterIndex,
    params.sectionIndex,
  ]);
}

export async function enqueueCourseSectionMaterialization(params: {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  reasonKey: string;
  priority?: number;
}): Promise<QueuedCourseProductionJob> {
  const queue = getCourseProductionQueue();
  const jobId = buildSectionJobId(params);
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    } else {
      return {
        id: existing.id ?? null,
        name: existing.name,
        type: "materialize_section",
      };
    }
  }

  const queued = await queue.add(
    "materialize-section",
    {
      type: "materialize_section",
      userId: params.userId,
      courseId: params.courseId,
      chapterIndex: params.chapterIndex,
      sectionIndex: params.sectionIndex,
      reasonKey: params.reasonKey,
    },
    {
      jobId,
      priority: params.priority,
    },
  );

  return {
    id: queued.id ?? null,
    name: queued.name,
    type: "materialize_section",
  };
}

export async function getCourseProductionJobSnapshot(
  jobId: string | null | undefined,
): Promise<CourseProductionJobSnapshot | null> {
  if (!jobId) {
    return null;
  }

  const job = await getCourseProductionQueue().getJob(jobId);
  if (!job) {
    return null;
  }

  return {
    id: job.id ?? jobId,
    state: await job.getState(),
  };
}

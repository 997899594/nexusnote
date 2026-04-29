import { Queue } from "bullmq";
import type { CourseOutline } from "@/lib/learning/course-outline";
import { getRedis } from "@/lib/redis";

const INITIAL_MATERIALIZATION_WINDOW_SIZE = 2;

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

let courseProductionQueue: Queue<CourseProductionJobData> | null = null;

export function getCourseProductionQueue(): Queue<CourseProductionJobData> {
  if (courseProductionQueue) {
    return courseProductionQueue;
  }

  courseProductionQueue = new Queue<CourseProductionJobData>("course-production", {
    connection: getRedis() as never,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1500,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return courseProductionQueue;
}

function buildSectionJobId(params: {
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
}) {
  return ["course-section", params.courseId, params.chapterIndex, params.sectionIndex].join(":");
}

interface CourseSectionTarget {
  chapterIndex: number;
  sectionIndex: number;
}

function listCourseSectionTargets(outline: CourseOutline): CourseSectionTarget[] {
  return outline.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.map((_, sectionIndex) => ({
      chapterIndex,
      sectionIndex,
    })),
  );
}

export function resolveNextCourseSectionTarget(params: {
  outline: CourseOutline;
  chapterIndex: number;
  sectionIndex: number;
}): CourseSectionTarget | null {
  const targets = listCourseSectionTargets(params.outline);
  const currentIndex = targets.findIndex(
    (target) =>
      target.chapterIndex === params.chapterIndex && target.sectionIndex === params.sectionIndex,
  );

  return currentIndex >= 0 ? (targets[currentIndex + 1] ?? null) : null;
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

export async function enqueueInitialCourseMaterialization(params: {
  userId: string;
  courseId: string;
  outline: CourseOutline;
}): Promise<QueuedCourseProductionJob[]> {
  const targets = listCourseSectionTargets(params.outline).slice(
    0,
    INITIAL_MATERIALIZATION_WINDOW_SIZE,
  );

  return Promise.all(
    targets.map((target, index) =>
      enqueueCourseSectionMaterialization({
        userId: params.userId,
        courseId: params.courseId,
        ...target,
        reasonKey: index === 0 ? "course-created:first-section" : "course-created:prewarm",
        priority: index === 0 ? 1 : 5,
      }),
    ),
  );
}

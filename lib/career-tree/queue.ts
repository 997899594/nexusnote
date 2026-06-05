import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";
import { getCareerTreeQueue } from "@/lib/queue/career-tree-queue";

export interface QueuedCareerTreeJob {
  id: string | null;
  name: string;
  type: CareerTreeJobData["type"];
}

function getCareerTreeJobId(job: CareerTreeJobData): string {
  switch (job.type) {
    case "compose_user_career_trees":
      return `career-tree:compose:${job.userId}`;
    case "refresh_user_career_tree_snapshot":
      return [
        "career-tree:refresh",
        job.userId,
        job.courseId ?? "all",
        job.reasonKey ?? "manual",
      ].join(":");
    case "extract_course_evidence":
      return `career-tree:extract:${job.userId}:${job.courseId}`;
    case "merge_user_skill_graph":
      return ["career-tree:merge", job.userId, job.courseId, job.extractRunId ?? "latest"].join(
        ":",
      );
  }
}

async function enqueueCareerTreeJob(job: CareerTreeJobData): Promise<QueuedCareerTreeJob> {
  const queued = await getCareerTreeQueue().add(job.type, job, {
    jobId: getCareerTreeJobId(job),
  });

  return {
    id: queued.id ?? null,
    name: queued.name,
    type: job.type,
  };
}

export async function enqueueCareerTreeExtract(
  userId: string,
  courseId: string,
): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "extract_course_evidence",
    userId,
    courseId,
  });
}

export async function enqueueCareerTreeMerge(
  userId: string,
  courseId: string,
  extractRunId?: string,
): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "merge_user_skill_graph",
    userId,
    courseId,
    extractRunId,
  });
}

export async function enqueueCareerTreeCompose(userId: string): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "compose_user_career_trees",
    userId,
  });
}

export async function enqueueCareerTreeRefresh(params: {
  userId: string;
  courseId?: string;
  reasonKey?: string;
}): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "refresh_user_career_tree_snapshot",
    userId: params.userId,
    courseId: params.courseId,
    reasonKey: params.reasonKey,
  });
}

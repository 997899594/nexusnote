import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";
import { getCareerTreeQueue } from "@/lib/queue/career-tree-queue";

export interface QueuedCareerTreeJob {
  id: string | null;
  name: string;
  type: CareerTreeJobData["type"];
}

async function enqueueCareerTreeJob(job: CareerTreeJobData): Promise<QueuedCareerTreeJob> {
  const queued = await getCareerTreeQueue().add(job.type, job);

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

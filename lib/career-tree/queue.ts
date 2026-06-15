import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";
import { getCareerTreeQueue } from "@/lib/queue/career-tree-queue";
import { buildSafeJobId } from "@/lib/queue/job-id";

export interface QueuedCareerTreeJob {
  id: string | null;
  name: string;
  type: CareerTreeJobData["type"];
}

export function createCareerTreeRequestKey(prefix = "manual"): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function getCareerTreeJobRequestPart(job: CareerTreeJobData): string | undefined {
  return job.requestKey;
}

function getCareerTreeJobId(job: CareerTreeJobData): string {
  const requestPart = getCareerTreeJobRequestPart(job);

  switch (job.type) {
    case "compose_user_career_trees":
      return buildSafeJobId(["career-tree", "compose", job.userId, requestPart]);
    case "refresh_user_career_tree_snapshot":
      return buildSafeJobId([
        "career-tree",
        "refresh",
        job.userId,
        job.courseId ?? "all",
        job.reasonKey ?? "manual",
        requestPart,
      ]);
    case "extract_course_evidence":
      return buildSafeJobId(["career-tree", "extract", job.userId, job.courseId, requestPart]);
    case "merge_user_skill_graph":
      return buildSafeJobId([
        "career-tree",
        "merge",
        job.userId,
        job.courseId,
        job.extractRunId ?? "latest",
        requestPart,
      ]);
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
  requestKey?: string,
): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "extract_course_evidence",
    userId,
    courseId,
    requestKey,
  });
}

export async function enqueueCareerTreeMerge(
  userId: string,
  courseId: string,
  extractRunId?: string,
  requestKey?: string,
): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "merge_user_skill_graph",
    userId,
    courseId,
    extractRunId,
    requestKey,
  });
}

export async function enqueueCareerTreeCompose(
  userId: string,
  requestKey?: string,
): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "compose_user_career_trees",
    userId,
    requestKey,
  });
}

export async function enqueueCareerTreeRefresh(params: {
  userId: string;
  courseId?: string;
  reasonKey?: string;
  requestKey?: string;
}): Promise<QueuedCareerTreeJob> {
  return enqueueCareerTreeJob({
    type: "refresh_user_career_tree_snapshot",
    userId: params.userId,
    courseId: params.courseId,
    reasonKey: params.reasonKey,
    requestKey: params.requestKey,
  });
}

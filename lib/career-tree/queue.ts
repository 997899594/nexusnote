import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";
import { getCareerTreeQueue } from "@/lib/queue/career-tree-queue";
import { buildSafeJobId } from "@/lib/queue/job-id";
import { getCareerTreeStageForJobType, logCareerTreePipelineEvent } from "./pipeline-log";

export interface QueuedCareerTreeJob {
  id: string | null;
  name: string;
  type: CareerTreeJobData["type"];
  requestKey: string;
}

export function createCareerTreeRequestKey(prefix = "manual"): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

type CareerTreeJobWithRequestKey = CareerTreeJobData & { requestKey: string };

function getDefaultCareerTreeRequestKeyPrefix(type: CareerTreeJobData["type"]): string {
  switch (type) {
    case "refresh_user_career_tree_snapshot":
      return "refresh";
    case "extract_course_evidence":
      return "extract";
    case "merge_user_skill_graph":
      return "merge";
    case "compose_user_career_trees":
      return "compose";
  }
}

function withCareerTreeRequestKey<TJob extends CareerTreeJobData>(
  job: TJob,
): TJob & { requestKey: string } {
  return {
    ...job,
    requestKey:
      job.requestKey ?? createCareerTreeRequestKey(getDefaultCareerTreeRequestKeyPrefix(job.type)),
  };
}

function getCareerTreeJobId(job: CareerTreeJobWithRequestKey): string {
  switch (job.type) {
    case "compose_user_career_trees":
      return buildSafeJobId(["career-tree", "compose", job.userId, job.requestKey]);
    case "refresh_user_career_tree_snapshot":
      return buildSafeJobId([
        "career-tree",
        "refresh",
        job.userId,
        job.courseId ?? "all",
        job.reasonKey ?? "manual",
        job.requestKey,
      ]);
    case "extract_course_evidence":
      return buildSafeJobId(["career-tree", "extract", job.userId, job.courseId, job.requestKey]);
    case "merge_user_skill_graph":
      return buildSafeJobId([
        "career-tree",
        "merge",
        job.userId,
        job.courseId,
        job.extractRunId ?? "latest",
        job.requestKey,
      ]);
  }
}

async function enqueueCareerTreeJob(input: CareerTreeJobData): Promise<QueuedCareerTreeJob> {
  const job = withCareerTreeRequestKey(input);
  const queued = await getCareerTreeQueue().add(job.type, job, {
    jobId: getCareerTreeJobId(job),
  });
  logCareerTreePipelineEvent("career_tree_job_enqueued", {
    stage: getCareerTreeStageForJobType(job.type),
    jobType: job.type,
    jobId: queued.id ?? null,
    userId: job.userId,
    courseId: "courseId" in job ? job.courseId : null,
    requestKey: job.requestKey ?? null,
    reasonKey: "reasonKey" in job ? job.reasonKey : null,
    extractRunId: "extractRunId" in job ? job.extractRunId : null,
  });

  return {
    id: queued.id ?? null,
    name: queued.name,
    type: job.type,
    requestKey: job.requestKey,
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

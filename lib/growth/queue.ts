import type { GrowthJobData } from "@/lib/queue/growth-queue";
import { getGrowthQueue } from "@/lib/queue/growth-queue";

async function enqueueGrowthJob(job: GrowthJobData): Promise<void> {
  await getGrowthQueue().add(job.type, job);
}

export async function enqueueGrowthExtract(userId: string, courseId: string): Promise<void> {
  await enqueueGrowthJob({
    type: "extract_course_evidence",
    userId,
    courseId,
  });
}

export async function enqueueGrowthMerge(
  userId: string,
  courseId: string,
  extractRunId?: string,
  affectedNodeIds?: string[],
): Promise<void> {
  await enqueueGrowthJob({
    type: "merge_user_skill_graph",
    userId,
    courseId,
    extractRunId,
    affectedNodeIds,
  });
}

export async function enqueueKnowledgeSourceMerge(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  affectedNodeIds?: string[];
}): Promise<void> {
  await enqueueGrowthJob({
    type: "merge_knowledge_source_evidence",
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash: params.sourceVersionHash,
    affectedNodeIds: params.affectedNodeIds,
  });
}

export async function enqueueGrowthCompose(userId: string): Promise<void> {
  await enqueueGrowthJob({
    type: "compose_user_growth_snapshot",
    userId,
  });
}

export async function enqueueGrowthProjection(userId: string): Promise<void> {
  await enqueueGrowthJob({
    type: "project_user_growth_views",
    userId,
  });
}

export async function enqueueGrowthRefresh(
  userId: string,
  courseId?: string,
  nodeIds?: string[],
  reasonKey?: string,
): Promise<void> {
  await enqueueGrowthJob({
    type: "refresh_user_skill_graph",
    userId,
    courseId,
    nodeIds,
    reasonKey,
  });
}

export async function enqueueKnowledgeInsights(userId: string): Promise<void> {
  await enqueueGrowthJob({
    type: "derive_user_insights",
    userId,
  });
}

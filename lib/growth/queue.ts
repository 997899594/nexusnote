import { growthQueue } from "@/lib/queue/growth-queue";

export async function enqueueGrowthExtract(userId: string, courseId: string): Promise<void> {
  await growthQueue.add("extract_course_evidence", {
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
  await growthQueue.add("merge_user_skill_graph", {
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
  await growthQueue.add("merge_knowledge_source_evidence", {
    type: "merge_knowledge_source_evidence",
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash: params.sourceVersionHash,
    affectedNodeIds: params.affectedNodeIds,
  });
}

export async function enqueueGrowthCompose(userId: string): Promise<void> {
  await growthQueue.add("compose_user_growth_snapshot", {
    type: "compose_user_growth_snapshot",
    userId,
  });
}

export async function enqueueGrowthProjection(userId: string): Promise<void> {
  await growthQueue.add("project_user_growth_views", {
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
  await growthQueue.add("refresh_user_skill_graph", {
    type: "refresh_user_skill_graph",
    userId,
    courseId,
    nodeIds,
    reasonKey,
  });
}

export async function enqueueKnowledgeInsights(userId: string): Promise<void> {
  await growthQueue.add("derive_user_insights", {
    type: "derive_user_insights",
    userId,
  });
}

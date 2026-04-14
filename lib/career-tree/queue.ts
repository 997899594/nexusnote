import { careerTreeQueue } from "@/lib/queue/career-tree-queue";

export async function enqueueCareerTreeExtract(userId: string, courseId: string): Promise<void> {
  await careerTreeQueue.add("extract_course_evidence", {
    type: "extract_course_evidence",
    userId,
    courseId,
  });
}

export async function enqueueCareerTreeMerge(
  userId: string,
  courseId: string,
  extractRunId?: string,
  affectedNodeIds?: string[],
): Promise<void> {
  await careerTreeQueue.add("merge_user_skill_graph", {
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
  await careerTreeQueue.add("merge_knowledge_source_evidence", {
    type: "merge_knowledge_source_evidence",
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash: params.sourceVersionHash,
    affectedNodeIds: params.affectedNodeIds,
  });
}

export async function enqueueCareerTreeCompose(userId: string): Promise<void> {
  await careerTreeQueue.add("compose_user_career_trees", {
    type: "compose_user_career_trees",
    userId,
  });
}

export async function enqueueCareerTreeRefresh(
  userId: string,
  courseId?: string,
  nodeIds?: string[],
): Promise<void> {
  await careerTreeQueue.add("refresh_user_skill_graph", {
    type: "refresh_user_skill_graph",
    userId,
    courseId,
    nodeIds,
  });
}

export async function enqueueKnowledgeInsights(userId: string): Promise<void> {
  await careerTreeQueue.add("derive_user_insights", {
    type: "derive_user_insights",
    userId,
  });
}

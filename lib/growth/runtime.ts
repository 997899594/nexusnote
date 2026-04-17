import { processKnowledgeInsightsJob } from "@/lib/knowledge/insights/jobs";
import {
  processGrowthComposeJob,
  processGrowthExtractJob,
  processGrowthMergeJob,
  processGrowthProjectionJob,
  processGrowthRefreshJob,
  processKnowledgeSourceMergeJob,
} from "./jobs";

const NO_FOLLOWUPS = { enqueueFollowups: false } as const;

async function runWithoutFollowups<T>(
  runner: (payload: T, options: typeof NO_FOLLOWUPS) => Promise<void>,
  payload: T,
): Promise<void> {
  await runner(payload, NO_FOLLOWUPS);
}

export async function runGrowthCoursePipeline(params: {
  userId: string;
  courseId: string;
}): Promise<void> {
  await runWithoutFollowups(processGrowthExtractJob, {
    type: "extract_course_evidence",
    userId: params.userId,
    courseId: params.courseId,
  });

  await runWithoutFollowups(processGrowthMergeJob, {
    type: "merge_user_skill_graph",
    userId: params.userId,
    courseId: params.courseId,
  });
}

export async function runGrowthSourcePipeline(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  affectedNodeIds?: string[];
}): Promise<void> {
  await runWithoutFollowups(processKnowledgeSourceMergeJob, {
    type: "merge_knowledge_source_evidence",
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash: params.sourceVersionHash,
    affectedNodeIds: params.affectedNodeIds,
  });
}

export async function runGrowthRefreshPipeline(params: {
  userId: string;
  courseId?: string;
  nodeIds?: string[];
  reasonKey?: string;
}): Promise<void> {
  await runWithoutFollowups(processGrowthRefreshJob, {
    type: "refresh_user_skill_graph",
    userId: params.userId,
    courseId: params.courseId,
    nodeIds: params.nodeIds,
    reasonKey: params.reasonKey,
  });
}

export async function runGrowthProjectionPipeline(userId: string): Promise<void> {
  await runWithoutFollowups(processGrowthComposeJob, {
    type: "compose_user_growth_snapshot",
    userId,
  });

  await runWithoutFollowups(processGrowthProjectionJob, {
    type: "project_user_growth_views",
    userId,
  });

  await processKnowledgeInsightsJob({
    type: "derive_user_insights",
    userId,
  });
}

import { processKnowledgeInsightsJob } from "@/lib/knowledge/insights/jobs";
import {
  processGrowthComposeJob,
  processGrowthExtractJob,
  processGrowthMergeJob,
  processGrowthProjectionJob,
  processGrowthRefreshJob,
  processKnowledgeSourceMergeJob,
} from "./jobs";

export async function runGrowthCoursePipeline(params: {
  userId: string;
  courseId: string;
}): Promise<void> {
  await processGrowthExtractJob(
    {
      type: "extract_course_evidence",
      userId: params.userId,
      courseId: params.courseId,
    },
    { enqueueFollowups: false },
  );

  await processGrowthMergeJob(
    {
      type: "merge_user_skill_graph",
      userId: params.userId,
      courseId: params.courseId,
    },
    { enqueueFollowups: false },
  );
}

export async function runGrowthSourcePipeline(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  affectedNodeIds?: string[];
}): Promise<void> {
  await processKnowledgeSourceMergeJob(
    {
      type: "merge_knowledge_source_evidence",
      userId: params.userId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceVersionHash: params.sourceVersionHash,
      affectedNodeIds: params.affectedNodeIds,
    },
    { enqueueFollowups: false },
  );
}

export async function runGrowthRefreshPipeline(params: {
  userId: string;
  courseId?: string;
  nodeIds?: string[];
  reasonKey?: string;
}): Promise<void> {
  await processGrowthRefreshJob(
    {
      type: "refresh_user_skill_graph",
      userId: params.userId,
      courseId: params.courseId,
      nodeIds: params.nodeIds,
      reasonKey: params.reasonKey,
    },
    { enqueueFollowups: false },
  );
}

export async function runGrowthProjectionPipeline(userId: string): Promise<void> {
  await processGrowthComposeJob(
    {
      type: "compose_user_growth_snapshot",
      userId,
    },
    { enqueueFollowups: false },
  );

  await processGrowthProjectionJob(
    {
      type: "project_user_growth_views",
      userId,
    },
    { enqueueFollowups: false },
  );

  await processKnowledgeInsightsJob({
    type: "derive_user_insights",
    userId,
  });
}

import { writeStructuredLog } from "@/lib/observability/structured-log";
import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";

export type CareerTreePipelineStage = "refresh" | "extract" | "merge" | "compose";

export type CareerTreePipelineEvent =
  | "career_tree_job_enqueued"
  | "career_tree_compose_output_repaired"
  | "career_tree_pipeline_started"
  | "career_tree_pipeline_succeeded"
  | "career_tree_pipeline_skipped"
  | "career_tree_pipeline_progress";

const stageByJobType = {
  refresh_user_career_tree_snapshot: "refresh",
  extract_course_evidence: "extract",
  merge_user_skill_graph: "merge",
  compose_user_career_trees: "compose",
} satisfies Record<CareerTreeJobData["type"], CareerTreePipelineStage>;

export function getCareerTreeStageForJobType(
  type: CareerTreeJobData["type"],
): CareerTreePipelineStage {
  return stageByJobType[type];
}

export function logCareerTreePipelineEvent(
  event: CareerTreePipelineEvent,
  fields: Record<string, unknown>,
): void {
  writeStructuredLog("info", event, {
    workflow: "career-tree",
    ...fields,
  });
}

export function logCareerTreePipelineSkip(fields: {
  stage: CareerTreePipelineStage;
  reason: string;
  userId: string;
  courseId?: string | null;
  requestKey?: string | null;
  runId?: string | null;
  [key: string]: unknown;
}): void {
  logCareerTreePipelineEvent("career_tree_pipeline_skipped", {
    courseId: null,
    requestKey: null,
    runId: null,
    ...fields,
  });
}

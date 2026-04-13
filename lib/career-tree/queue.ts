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
): Promise<void> {
  await careerTreeQueue.add("merge_user_skill_graph", {
    type: "merge_user_skill_graph",
    userId,
    courseId,
    extractRunId,
  });
}

export async function enqueueCareerTreeCompose(userId: string): Promise<void> {
  await careerTreeQueue.add("compose_user_career_trees", {
    type: "compose_user_career_trees",
    userId,
  });
}

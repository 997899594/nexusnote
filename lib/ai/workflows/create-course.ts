import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import type { GrowthGenerationContext } from "@/lib/growth/generation-context-format";
import { expandInterviewOutlineToCourseOutline } from "@/lib/learning/course-outline";
import { saveCourseFromOutline } from "@/lib/learning/course-service";

interface CreateCourseWorkflowOptions {
  userId: string;
  outline: InterviewOutline;
  generationContext?: GrowthGenerationContext;
  courseId?: string;
}

export async function runCreateCourseWorkflow({
  userId,
  outline,
  generationContext,
  courseId,
}: CreateCourseWorkflowOptions) {
  const courseOutline = await expandInterviewOutlineToCourseOutline({
    userId,
    outline,
    generationContext,
    courseId,
  });

  const result = await saveCourseFromOutline({
    userId,
    outline: courseOutline,
    courseId,
  });

  return {
    ...result,
    outline: courseOutline,
  };
}

import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import { createCourseOutlineFromInterviewOutline } from "@/lib/learning/course-outline";
import { saveCourseFromOutline } from "@/lib/learning/course-service";

interface CreateCourseWorkflowOptions {
  userId: string;
  outline: InterviewOutline;
  courseId?: string;
}

export async function runCreateCourseWorkflow({
  userId,
  outline,
  courseId,
}: CreateCourseWorkflowOptions) {
  const courseOutline = createCourseOutlineFromInterviewOutline(outline);

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

import type { CourseOutline } from "@/lib/learning/course-service";
import { saveCourseFromOutline } from "@/lib/learning/course-service";

interface CreateCourseWorkflowOptions {
  userId: string;
  outline: CourseOutline;
  courseId?: string;
}

export async function runCreateCourseWorkflow({
  userId,
  outline,
  courseId,
}: CreateCourseWorkflowOptions) {
  return saveCourseFromOutline({
    userId,
    outline,
    courseId,
  });
}

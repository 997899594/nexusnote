import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { InterviewOutlineSchema } from "@/lib/ai/interview/schemas";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows/create-course";
import { notFound, parseJsonBodyAs, withAuth } from "@/lib/api";
import {
  revalidateCareerTreeViews,
  revalidateCourseCreationViews,
} from "@/lib/cache/domain-events";
import { syncCourseOutlineKnowledgePipeline } from "@/lib/learning/course-knowledge-pipeline";
import { getOwnedCourse } from "@/lib/learning/course-repository";

const RequestSchema = z.object({
  outline: InterviewOutlineSchema,
  courseId: z.string().uuid().optional(),
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const { outline, courseId } = await parseJsonBodyAs(request, RequestSchema);

  if (courseId) {
    const existingCourse = await getOwnedCourse(courseId, userId);
    if (!existingCourse) {
      throw notFound("课程不存在", "COURSE_NOT_FOUND");
    }
  }

  const result = await runCreateCourseWorkflow({
    userId,
    courseId,
    outline,
  });

  revalidateCourseCreationViews(userId, result.courseId);
  after(async () => {
    try {
      await syncCourseOutlineKnowledgePipeline({
        userId,
        courseId: result.courseId,
        outline: result.outline,
      });
      revalidateCareerTreeViews(userId);
    } catch (error) {
      console.error("[CreateCourse] Failed to sync course knowledge pipeline:", error);
    }
  });

  return Response.json({
    success: true,
    courseId: result.courseId,
    outline: result.outline,
  });
});

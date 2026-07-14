import type { NextRequest } from "next/server";
import { z } from "zod";
import { InterviewOutlineSchema } from "@/lib/ai/interview/schemas";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows/create-course";
import { notFound, parseJsonBodyAs, withAuth } from "@/lib/api";
import { AI_CAPABILITIES, requireAICapability } from "@/lib/billing/capability-policy";
import {
  revalidateCourseCreationViews,
  revalidateCoursePublicationViews,
} from "@/lib/cache/domain-events";
import { getOwnedCourse } from "@/lib/learning/course-repository";

const RequestSchema = z.object({
  outline: InterviewOutlineSchema,
  courseId: z.string().uuid().optional(),
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const { outline, courseId } = await parseJsonBodyAs(request, RequestSchema);
  await requireAICapability(userId, AI_CAPABILITIES.courseGeneration);

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
  if (result.publicationRefresh) {
    revalidateCoursePublicationViews(result.publicationRefresh.slug);
    revalidateCoursePublicationViews(result.publicationRefresh.publicationId);
  }

  return Response.json({
    success: true,
    courseId: result.courseId,
    outline: result.outline,
  });
});

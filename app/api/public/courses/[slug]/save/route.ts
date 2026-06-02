import type { NextRequest } from "next/server";
import { notFound, withDynamicAuth } from "@/lib/api";
import { revalidateCourseCreationViews } from "@/lib/cache/domain-events";
import { savePublicCourseToLibrary } from "@/lib/learning/course-sharing";

interface RouteParams {
  slug: string;
}

export const POST = withDynamicAuth<unknown, RouteParams>(
  async (_request: NextRequest, { userId, params }) => {
    try {
      const result = await savePublicCourseToLibrary({
        slug: params.slug,
        userId,
      });

      revalidateCourseCreationViews(userId, result.courseId);

      return Response.json({
        ok: true,
        courseId: result.courseId,
        learnUrl: `/learn/${result.courseId}`,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_NOT_FOUND") {
        throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
      }
      throw error;
    }
  },
);

import type { NextRequest } from "next/server";
import { conflict, notFound, withDynamicAuth } from "@/lib/api";
import { revalidateProfileStats, revalidateRecentCourses } from "@/lib/cache/tags";
import { subscribePublicCourse } from "@/lib/learning/course-sharing";

interface RouteParams {
  slug: string;
}

export const POST = withDynamicAuth<unknown, RouteParams>(
  async (_request: NextRequest, { userId, params }) => {
    try {
      const result = await subscribePublicCourse({
        slug: params.slug,
        userId,
      });

      if (!result.alreadySubscribed) {
        revalidateRecentCourses(userId);
        revalidateProfileStats(userId);
      }

      return Response.json({
        ok: true,
        publicationId: result.publicationId,
        learnUrl: result.learnUrl,
        alreadySubscribed: result.alreadySubscribed,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_NOT_FOUND") {
        throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_SUBSCRIBE_FORBIDDEN") {
        throw conflict("作者无需订阅自己的课程", "COURSE_PUBLICATION_SUBSCRIBE_FORBIDDEN");
      }
      throw error;
    }
  },
);

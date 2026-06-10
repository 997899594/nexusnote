import type { NextRequest } from "next/server";
import { notFound, withDynamicAuth } from "@/lib/api";
import { togglePublicCourseLike } from "@/lib/learning/course-sharing";

interface RouteParams {
  slug: string;
}

export const POST = withDynamicAuth<unknown, RouteParams>(
  async (_request: NextRequest, { userId, params }) => {
    try {
      const result = await togglePublicCourseLike({
        slug: params.slug,
        userId,
      });

      return Response.json({ liked: result.liked });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_NOT_FOUND") {
        throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
      }
      throw error;
    }
  },
);

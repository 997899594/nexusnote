import type { NextRequest } from "next/server";
import { notFound, withDynamicAuth } from "@/lib/api";
import { revalidateCoursePublicationViews } from "@/lib/cache/domain-events";
import {
  getOwnedCoursePublicationStatus,
  publishCourse,
  revokeCoursePublication,
} from "@/lib/learning/course-sharing";

interface RouteParams {
  id: string;
}

function buildPublicCoursePath(slug: string): string {
  return `/c/${slug}`;
}

export const GET = withDynamicAuth<unknown, RouteParams>(
  async (_request: NextRequest, { userId, params }) => {
    try {
      const status = await getOwnedCoursePublicationStatus({
        courseId: params.id,
        userId,
      });

      return Response.json({
        ok: true,
        ...status,
        path: status.slug ? buildPublicCoursePath(status.slug) : null,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_FORBIDDEN") {
        throw notFound("课程不存在", "COURSE_NOT_FOUND");
      }
      throw error;
    }
  },
);

export const POST = withDynamicAuth<unknown, RouteParams>(async (_request, { userId, params }) => {
  try {
    const publication = await publishCourse({
      courseId: params.id,
      userId,
    });

    revalidateCoursePublicationViews(publication.slug);
    revalidateCoursePublicationViews(publication.publicationId);

    const status = await getOwnedCoursePublicationStatus({
      courseId: params.id,
      userId,
    });

    return Response.json({
      ok: true,
      ...publication,
      engagement: status.engagement,
      path: buildPublicCoursePath(publication.slug),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "COURSE_NOT_FOUND" || error.message === "COURSE_PUBLICATION_FORBIDDEN")
    ) {
      throw notFound("课程不存在", "COURSE_NOT_FOUND");
    }
    throw error;
  }
});

export const DELETE = withDynamicAuth<unknown, RouteParams>(
  async (_request: NextRequest, { userId, params }) => {
    let result: Awaited<ReturnType<typeof revokeCoursePublication>>;

    try {
      result = await revokeCoursePublication({
        courseId: params.id,
        userId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_FORBIDDEN") {
        throw notFound("课程不存在", "COURSE_NOT_FOUND");
      }
      throw error;
    }

    if (result.slug) {
      revalidateCoursePublicationViews(result.slug);
    }

    return Response.json({ ok: true, ...result });
  },
);

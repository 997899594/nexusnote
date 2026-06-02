import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, notFound, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import { revalidateCoursePublicationViews } from "@/lib/cache/domain-events";
import { updatePublicCourseAnnotationStatus } from "@/lib/learning/course-sharing";

interface RouteParams {
  slug: string;
  annotationId: string;
}

const PublicAnnotationStatusRequestSchema = z.object({
  status: z.enum(["visible", "hidden"]),
});

export const PATCH = withDynamicAuth<unknown, RouteParams>(
  async (request: NextRequest, { userId, params }) => {
    const routeParams = z
      .object({
        slug: z.string().min(1),
        annotationId: z.string().uuid(),
      })
      .safeParse(params);

    if (!routeParams.success) {
      throw badRequest("批注参数无效", "INVALID_PUBLIC_ANNOTATION_PARAMS");
    }

    const input = await parseJsonBodyAs(request, PublicAnnotationStatusRequestSchema);

    try {
      const annotation = await updatePublicCourseAnnotationStatus({
        slug: routeParams.data.slug,
        annotationId: routeParams.data.annotationId,
        userId,
        status: input.status,
      });

      revalidateCoursePublicationViews(routeParams.data.slug);

      return Response.json({ ok: true, annotation });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_NOT_FOUND") {
        throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_FORBIDDEN") {
        throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "COURSE_PUBLIC_ANNOTATION_NOT_FOUND") {
        throw notFound("公共批注不存在", "COURSE_PUBLIC_ANNOTATION_NOT_FOUND");
      }
      throw error;
    }
  },
);

import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import { updatePublicCourseAnnotationStatus } from "@/lib/learning/course-sharing";
import {
  handlePublicAnnotationMutationError,
  revalidatePublicAnnotationMutation,
} from "../annotation-route-helpers";

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
      const result = await updatePublicCourseAnnotationStatus({
        slug: routeParams.data.slug,
        annotationId: routeParams.data.annotationId,
        userId,
        status: input.status,
      });

      revalidatePublicAnnotationMutation(routeParams.data.slug, result);

      return Response.json({ ok: true, annotation: result.annotation });
    } catch (error) {
      handlePublicAnnotationMutationError(error);
    }
  },
);

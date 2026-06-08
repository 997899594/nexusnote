import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import { createPublicCourseAnnotation } from "@/lib/learning/course-sharing";
import {
  handlePublicAnnotationMutationError,
  revalidatePublicAnnotationMutation,
} from "./annotation-route-helpers";

interface RouteParams {
  slug: string;
}

const PublicAnnotationRequestSchema = z.object({
  sectionKey: z.string().min(1).max(120),
  anchor: z.object({
    textContent: z.string().min(1).max(500),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
  }),
  quotedText: z.string().min(1).max(500),
  body: z.string().trim().min(1).max(1200),
});

export const POST = withDynamicAuth<unknown, RouteParams>(
  async (request: NextRequest, { userId, params }) => {
    const input = await parseJsonBodyAs(request, PublicAnnotationRequestSchema);

    if (input.anchor.endOffset < input.anchor.startOffset) {
      throw badRequest("批注范围无效", "INVALID_ANNOTATION_ANCHOR");
    }

    try {
      const result = await createPublicCourseAnnotation({
        slug: params.slug,
        userId,
        sectionKey: input.sectionKey,
        anchor: input.anchor,
        quotedText: input.quotedText,
        body: input.body,
      });

      revalidatePublicAnnotationMutation(params.slug, result);

      return Response.json({ ok: true, annotation: result.annotation });
    } catch (error) {
      handlePublicAnnotationMutationError(error);
    }
  },
);

import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, notFound, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import { revalidateCoursePublicationViews } from "@/lib/cache/domain-events";
import { createPublicCourseAnnotation } from "@/lib/learning/course-sharing";

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
      const annotation = await createPublicCourseAnnotation({
        slug: params.slug,
        userId,
        sectionKey: input.sectionKey,
        anchor: input.anchor,
        quotedText: input.quotedText,
        body: input.body,
      });

      revalidateCoursePublicationViews(params.slug);

      return Response.json({ ok: true, annotation });
    } catch (error) {
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_NOT_FOUND") {
        throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "COURSE_PUBLICATION_SECTION_NOT_FOUND") {
        throw badRequest("批注小节不存在", "COURSE_PUBLICATION_SECTION_NOT_FOUND");
      }
      throw error;
    }
  },
);

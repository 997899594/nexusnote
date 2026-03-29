// app/api/learn/annotations/route.ts

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSectionAnnotations, courseSections, courses, db } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { revalidateLearnPage } from "@/lib/cache/tags";

const AnnotationSchema = z.object({
  id: z.string(),
  type: z.enum(["highlight", "note"]),
  anchor: z.object({
    textContent: z.string(),
    startOffset: z.number(),
    endOffset: z.number(),
  }),
  color: z.string().optional(),
  noteContent: z.string().optional(),
  createdAt: z.string(),
});

const RequestSchema = z.object({
  sectionId: z.string().uuid(),
  annotations: z.array(AnnotationSchema),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { sectionId, annotations } = parsed.data;

    const [section] = await db
      .select({ id: courseSections.id, courseId: courses.id })
      .from(courseSections)
      .innerJoin(courses, eq(courseSections.courseId, courses.id))
      .where(and(eq(courseSections.id, sectionId), eq(courses.userId, userId)))
      .limit(1);

    if (!section) {
      throw new APIError("小节不存在", 404, "NOT_FOUND");
    }

    await db
      .delete(courseSectionAnnotations)
      .where(
        and(
          eq(courseSectionAnnotations.courseSectionId, sectionId),
          eq(courseSectionAnnotations.userId, userId),
        ),
      );

    if (annotations.length > 0) {
      await db.insert(courseSectionAnnotations).values(
        annotations.map((annotation) => ({
          courseSectionId: sectionId,
          userId,
          type: annotation.type,
          anchor: annotation.anchor,
          color: annotation.color ?? null,
          noteContent: annotation.noteContent ?? null,
          createdAt: new Date(annotation.createdAt),
          updatedAt: new Date(),
        })),
      );
    }

    revalidateLearnPage(userId, section.courseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

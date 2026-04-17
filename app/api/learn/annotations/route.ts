// app/api/learn/annotations/route.ts

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSectionAnnotations, courseSections, courses, db } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { syncSectionAnnotationsKnowledge } from "@/lib/learning/annotation-knowledge";
import { parseSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";

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

type AnnotationInput = z.infer<typeof AnnotationSchema>;

function buildAnnotationRows(params: {
  sectionId: string;
  userId: string;
  annotations: AnnotationInput[];
}): Array<typeof courseSectionAnnotations.$inferInsert> {
  return params.annotations.map((annotation) => ({
    courseSectionId: params.sectionId,
    userId: params.userId,
    type: annotation.type,
    anchor: annotation.anchor,
    color: annotation.color ?? null,
    noteContent: annotation.noteContent ?? null,
    createdAt: new Date(annotation.createdAt),
    updatedAt: new Date(),
  }));
}

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
      .select({
        id: courseSections.id,
        courseId: courses.id,
        courseTitle: courses.title,
        outlineNodeKey: courseSections.outlineNodeKey,
      })
      .from(courseSections)
      .innerJoin(courses, eq(courseSections.courseId, courses.id))
      .where(and(eq(courseSections.id, sectionId), eq(courses.userId, userId)))
      .limit(1);

    if (!section) {
      throw new APIError("小节不存在", 404, "NOT_FOUND");
    }

    const parsedSectionKey = parseSectionOutlineNodeKey(section.outlineNodeKey);
    const chapterKey = parsedSectionKey?.chapterKey ?? null;

    await db
      .delete(courseSectionAnnotations)
      .where(
        and(
          eq(courseSectionAnnotations.courseSectionId, sectionId),
          eq(courseSectionAnnotations.userId, userId),
        ),
      );

    const inserted =
      annotations.length > 0
        ? await db
            .insert(courseSectionAnnotations)
            .values(buildAnnotationRows({ sectionId, userId, annotations }))
            .returning({
              id: courseSectionAnnotations.id,
            })
        : [];

    await syncSectionAnnotationsKnowledge({
      userId,
      sectionId,
      courseId: section.courseId,
      courseTitle: section.courseTitle,
      chapterKey,
      annotations: inserted.map((saved, index) => ({
        id: saved.id,
        type: annotations[index].type,
        anchor: annotations[index].anchor,
        color: annotations[index].color ?? null,
        noteContent: annotations[index].noteContent ?? null,
        createdAt: annotations[index].createdAt,
      })),
    });

    revalidateLearnPage(userId, section.courseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

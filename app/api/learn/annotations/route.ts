// app/api/learn/annotations/route.ts

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSectionAnnotations, courseSections, courses, db } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { enqueueKnowledgeInsights } from "@/lib/career-tree/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateSourceEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence";

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
      const inserted = await db
        .insert(courseSectionAnnotations)
        .values(
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
        )
        .returning({
          id: courseSectionAnnotations.id,
          type: courseSectionAnnotations.type,
          noteContent: courseSectionAnnotations.noteContent,
          anchor: courseSectionAnnotations.anchor,
        });

      for (let index = 0; index < inserted.length; index++) {
        const saved = inserted[index];
        const original = annotations[index];
        await ingestEvidenceEvent({
          id: crypto.randomUUID(),
          userId,
          kind: saved.type === "note" ? "note" : "highlight",
          sourceType: "annotation",
          sourceId: sectionId,
          sourceVersionHash: null,
          title: saved.type === "note" ? "课程标注笔记" : "课程高亮",
          summary: original.noteContent?.trim() || original.anchor.textContent,
          confidence: 1,
          happenedAt: new Date(original.createdAt).toISOString(),
          metadata: {
            annotationId: saved.id,
            sectionId,
            annotationType: saved.type,
            color: original.color ?? null,
          },
          refs: [
            {
              refType: "annotation",
              refId: saved.id,
              snippet: original.anchor.textContent,
              weight: 1,
            },
            {
              refType: "course_section",
              refId: sectionId,
              snippet: original.anchor.textContent,
              weight: 1,
            },
          ],
        });
      }

      await aggregateSourceEventsToKnowledgeEvidence({
        userId,
        sourceType: "annotation",
        sourceId: sectionId,
        sourceVersionHash: null,
      });
      await enqueueKnowledgeInsights(userId);
    }

    revalidateLearnPage(userId, section.courseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

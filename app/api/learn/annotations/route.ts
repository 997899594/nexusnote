// app/api/learn/annotations/route.ts

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSectionAnnotations, courseSections, courses, db } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { syncKnowledgeSource } from "@/lib/knowledge/source-sync";
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

function buildAnnotationEvidenceRefs(params: {
  annotationId: string;
  sectionId: string;
  sectionText: string;
  courseId: string;
  courseTitle: string;
  chapterKey: string | null;
}): Array<{
  refType: string;
  refId: string;
  snippet: string | null;
  weight: number;
}> {
  const refs: Array<{
    refType: string;
    refId: string;
    snippet: string | null;
    weight: number;
  }> = [
    {
      refType: "annotation",
      refId: params.annotationId,
      snippet: params.sectionText,
      weight: 1,
    },
    {
      refType: "course_section",
      refId: params.sectionId,
      snippet: params.sectionText,
      weight: 1,
    },
    {
      refType: "course",
      refId: params.courseId,
      snippet: params.courseTitle,
      weight: 1,
    },
  ];

  if (params.chapterKey) {
    refs.push({
      refType: "chapter",
      refId: params.chapterKey,
      snippet: null,
      weight: 1,
    });
  }

  return refs;
}

function buildAnnotationEventTitle(type: z.infer<typeof AnnotationSchema>["type"]): string {
  return type === "note" ? "课程标注笔记" : "课程高亮";
}

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

async function ingestAnnotationEvents(params: {
  inserted: Array<{ id: string }>;
  annotations: AnnotationInput[];
  userId: string;
  sectionId: string;
  courseId: string;
  courseTitle: string;
  chapterKey: string | null;
}): Promise<void> {
  for (let index = 0; index < params.inserted.length; index++) {
    const saved = params.inserted[index];
    const original = params.annotations[index];
    const annotationType = original.type;

    await ingestEvidenceEvent({
      id: crypto.randomUUID(),
      userId: params.userId,
      kind: annotationType === "note" ? "note" : "highlight",
      sourceType: "annotation",
      sourceId: params.sectionId,
      sourceVersionHash: null,
      title: buildAnnotationEventTitle(annotationType),
      summary: original.noteContent?.trim() || original.anchor.textContent,
      confidence: 1,
      happenedAt: new Date(original.createdAt).toISOString(),
      metadata: {
        annotationId: saved.id,
        sectionId: params.sectionId,
        annotationType,
        color: original.color ?? null,
      },
      refs: buildAnnotationEvidenceRefs({
        annotationId: saved.id,
        sectionId: params.sectionId,
        sectionText: original.anchor.textContent,
        courseId: params.courseId,
        courseTitle: params.courseTitle,
        chapterKey: params.chapterKey,
      }),
    });
  }
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

    await syncKnowledgeSource({
      userId,
      sourceType: "annotation",
      sourceId: sectionId,
      hasContent: annotations.length > 0,
      clearReason: `annotation-clear:${sectionId}`,
      replaceEvents: async () => {
        if (annotations.length === 0) {
          return;
        }

        const inserted = await db
          .insert(courseSectionAnnotations)
          .values(buildAnnotationRows({ sectionId, userId, annotations }))
          .returning({
            id: courseSectionAnnotations.id,
          });

        await ingestAnnotationEvents({
          inserted,
          annotations,
          userId,
          sectionId,
          courseId: section.courseId,
          courseTitle: section.courseTitle,
          chapterKey,
        });
      },
    });

    revalidateLearnPage(userId, section.courseId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

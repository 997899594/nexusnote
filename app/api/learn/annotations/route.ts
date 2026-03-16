// app/api/learn/annotations/route.ts

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db, documents } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

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
  documentId: z.string().uuid(),
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

    const { documentId, annotations } = parsed.data;

    // Verify document exists and belongs to user's course (JOIN for ownership check)
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .innerJoin(courseSessions, eq(documents.courseId, courseSessions.id))
      .where(and(eq(documents.id, documentId), eq(courseSessions.userId, userId)))
      .limit(1);

    if (!doc) {
      throw new APIError("文档不存在", 404, "NOT_FOUND");
    }

    // Update metadata with full annotation replacement
    await db
      .update(documents)
      .set({
        metadata: { annotations },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

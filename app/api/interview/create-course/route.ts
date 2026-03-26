import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courses, db } from "@/db";
import { InterviewOutlineSchema } from "@/lib/ai/interview";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { expandInterviewOutlineToCourseOutline } from "@/lib/learning/course-service";

const RequestSchema = z.object({
  outline: InterviewOutlineSchema,
  courseId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new APIError("无效的 JSON", 400, "INVALID_JSON");
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
        { status: 400 },
      );
    }

    const { outline, courseId } = parsed.data;

    if (courseId) {
      const [existingCourse] = await db
        .select({ id: courses.id, userId: courses.userId })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!existingCourse || existingCourse.userId !== userId) {
        throw new APIError("课程不存在", 404, "NOT_FOUND");
      }
    }

    const expandedOutline = await expandInterviewOutlineToCourseOutline(outline);

    const result = await runCreateCourseWorkflow({
      userId,
      courseId,
      outline: expandedOutline,
    });

    return NextResponse.json({
      success: true,
      courseId: result.courseId,
      outline,
    });
  } catch (error) {
    return handleError(error);
  }
}

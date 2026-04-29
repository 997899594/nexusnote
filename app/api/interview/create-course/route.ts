import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InterviewOutlineSchema } from "@/lib/ai/interview/schemas";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows/create-course";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  revalidateCareerTrees,
  revalidateLearnPage,
  revalidateProfileStats,
  revalidateRecentCourses,
} from "@/lib/cache/tags";
import { syncCourseOutlineKnowledgePipeline } from "@/lib/learning/course-knowledge-pipeline";
import { getOwnedCourse } from "@/lib/learning/course-repository";
import { enqueueInitialCourseMaterialization } from "@/lib/queue/course-production-queue";

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
      const existingCourse = await getOwnedCourse(courseId, userId);
      if (!existingCourse) {
        throw new APIError("课程不存在", 404, "NOT_FOUND");
      }
    }

    const result = await runCreateCourseWorkflow({
      userId,
      courseId,
      outline,
    });

    revalidateRecentCourses(userId);
    revalidateProfileStats(userId);
    revalidateLearnPage(userId, result.courseId);
    after(async () => {
      const [productionResult, knowledgeResult] = await Promise.allSettled([
        enqueueInitialCourseMaterialization({
          userId,
          courseId: result.courseId,
          outline: result.outline,
        }),
        syncCourseOutlineKnowledgePipeline({
          userId,
          courseId: result.courseId,
          outline: result.outline,
        }),
      ]);

      if (productionResult.status === "rejected") {
        console.error(
          "[CreateCourse] Failed to enqueue course production:",
          productionResult.reason,
        );
      }

      if (knowledgeResult.status === "rejected") {
        console.error(
          "[CreateCourse] Failed to sync course knowledge pipeline:",
          knowledgeResult.reason,
        );
      } else {
        revalidateCareerTrees(userId);
      }
    });

    return NextResponse.json({
      success: true,
      courseId: result.courseId,
      outline: result.outline,
    });
  } catch (error) {
    return handleError(error);
  }
}

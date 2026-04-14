import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InterviewOutlineSchema } from "@/lib/ai/interview";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  revalidateGoldenPath,
  revalidateLearnPage,
  revalidateProfileStats,
  revalidateRecentCourses,
} from "@/lib/cache/tags";
import {
  computeCareerOutlineHash,
  getUserGenerationContext,
  normalizeCareerOutline,
} from "@/lib/career-tree";
import { enqueueCareerTreeExtract, enqueueKnowledgeInsights } from "@/lib/career-tree/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { getOwnedCourse } from "@/lib/learning/course-repository";
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
    const generationContext = await getUserGenerationContext(userId);

    if (courseId) {
      const existingCourse = await getOwnedCourse(courseId, userId);
      if (!existingCourse) {
        throw new APIError("课程不存在", 404, "NOT_FOUND");
      }
    }

    const expandedOutline = await expandInterviewOutlineToCourseOutline(outline);

    const result = await runCreateCourseWorkflow({
      userId,
      courseId,
      outline: expandedOutline,
    });

    revalidateRecentCourses(userId);
    revalidateProfileStats(userId);
    revalidateLearnPage(userId, result.courseId);
    revalidateGoldenPath(userId);

    const normalizedOutline = normalizeCareerOutline(expandedOutline);
    const outlineHash = computeCareerOutlineHash(normalizedOutline);

    await ingestEvidenceEvent({
      id: crypto.randomUUID(),
      userId,
      kind: "course_outline",
      sourceType: "course",
      sourceId: result.courseId,
      sourceVersionHash: outlineHash,
      title: expandedOutline.title,
      summary: expandedOutline.description,
      confidence: 1,
      happenedAt: new Date().toISOString(),
      metadata: {
        chapterCount: normalizedOutline.chapters.length,
        courseSkillIds: normalizedOutline.courseSkillIds,
        generationContext,
        chapterSkillIds: normalizedOutline.chapters.map((chapter) => ({
          chapterKey: chapter.chapterKey,
          skillIds: chapter.explicitSkillIds,
        })),
      },
      refs: normalizedOutline.chapters.map((chapter) => ({
        refType: "chapter",
        refId: chapter.chapterKey,
        snippet: chapter.title,
        weight: 1,
      })),
    });

    await enqueueCareerTreeExtract(userId, result.courseId);
    await enqueueKnowledgeInsights(userId);

    return NextResponse.json({
      success: true,
      courseId: result.courseId,
      outline,
    });
  } catch (error) {
    return handleError(error);
  }
}

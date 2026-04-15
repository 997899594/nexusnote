import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { InterviewOutlineSchema } from "@/lib/ai/interview";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  revalidateCareerTrees,
  revalidateLearnPage,
  revalidateProfileStats,
  revalidateRecentCourses,
} from "@/lib/cache/tags";
import {
  computeGrowthOutlineHash,
  getUserGrowthContext,
  normalizeGrowthOutline,
} from "@/lib/growth";
import { enqueueGrowthExtract, enqueueKnowledgeInsights } from "@/lib/growth/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { buildCourseBlueprintAlignmentBrief } from "@/lib/learning/alignment";
import { getOwnedCourse } from "@/lib/learning/course-repository";

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
    const generationContext = await getUserGrowthContext(userId);

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
      generationContext,
    });

    revalidateRecentCourses(userId);
    revalidateProfileStats(userId);
    revalidateLearnPage(userId, result.courseId);
    revalidateCareerTrees(userId);

    const normalizedOutline = normalizeGrowthOutline(result.outline);
    const outlineHash = computeGrowthOutlineHash(normalizedOutline);
    const courseAlignment = buildCourseBlueprintAlignmentBrief({
      courseTitle: result.outline.title,
      courseDescription: result.outline.description,
      courseSkillIds: result.outline.courseSkillIds,
      chapterTitles: result.outline.chapters.map((chapter) => chapter.title),
      chapterSkillIds: result.outline.chapters.flatMap((chapter) => chapter.skillIds ?? []),
      generationContext,
    });

    await ingestEvidenceEvent({
      id: crypto.randomUUID(),
      userId,
      kind: "course_outline",
      sourceType: "course",
      sourceId: result.courseId,
      sourceVersionHash: outlineHash,
      title: result.outline.title,
      summary: result.outline.description,
      confidence: 1,
      happenedAt: new Date().toISOString(),
      metadata: {
        chapterCount: normalizedOutline.chapters.length,
        courseSkillIds: normalizedOutline.courseSkillIds,
        generationContext,
        courseAlignment,
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

    await enqueueGrowthExtract(userId, result.courseId);
    await enqueueKnowledgeInsights(userId);

    return NextResponse.json({
      success: true,
      courseId: result.courseId,
      outline: result.outline,
    });
  } catch (error) {
    return handleError(error);
  }
}

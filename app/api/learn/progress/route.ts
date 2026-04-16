// app/api/learn/progress/route.ts

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseProgress, db } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  revalidateCareerTrees,
  revalidateLearnPage,
  revalidateRecentCourses,
} from "@/lib/cache/tags";
import { computeGrowthOutlineHash, normalizeGrowthOutline } from "@/lib/growth/normalize-outline";
import { enqueueGrowthRefresh } from "@/lib/growth/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateCourseEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  sectionNodeId: z.string().min(1),
});

interface CourseProgress {
  currentChapter: number;
  completedChapters: number[];
  completedSections: string[];
  startedAt: Date | null;
  completedAt: Date | null;
}

interface PersistedCourseProgressRecord extends CourseProgress {
  id?: string;
}

async function getOwnedCourseOrThrow(userId: string, courseId: string) {
  const course = await getOwnedCourseWithOutline(courseId, userId);
  if (!course) {
    throw new APIError("课程不存在", 404, "NOT_FOUND");
  }

  return course;
}

async function getPersistedCourseProgress(
  courseId: string,
): Promise<PersistedCourseProgressRecord | null> {
  const [progressRecord] = await db
    .select({
      id: courseProgress.id,
      currentChapter: courseProgress.currentChapter,
      completedChapters: courseProgress.completedChapters,
      completedSections: courseProgress.completedSections,
      startedAt: courseProgress.startedAt,
      completedAt: courseProgress.completedAt,
    })
    .from(courseProgress)
    .where(eq(courseProgress.courseId, courseId))
    .limit(1);

  return progressRecord ?? null;
}

async function persistCourseProgress(params: {
  courseId: string;
  userId: string;
  progress: CourseProgress;
  existingRecordId?: string;
}): Promise<void> {
  const values = {
    ...params.progress,
    updatedAt: new Date(),
  };

  if (params.existingRecordId) {
    await db
      .update(courseProgress)
      .set(values)
      .where(eq(courseProgress.id, params.existingRecordId));
    return;
  }

  await db.insert(courseProgress).values({
    courseId: params.courseId,
    userId: params.userId,
    ...values,
  });
}

function revalidateCourseProgressViews(userId: string, courseId: string): void {
  revalidateRecentCourses(userId);
  revalidateLearnPage(userId, courseId);
  revalidateCareerTrees(userId);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("未登录", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const { courseId, sectionNodeId } = RequestSchema.parse(body);

    const course = await getOwnedCourseOrThrow(userId, courseId);
    const progressRecord = await getPersistedCourseProgress(courseId);

    const existing: Partial<CourseProgress> = progressRecord ?? {};
    const completedSections = existing.completedSections ?? [];

    // Deduplicate: skip if already completed
    if (completedSections.includes(sectionNodeId)) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    completedSections.push(sectionNodeId);

    // Check chapter completion: if all sections in a chapter are done, mark chapter complete
    const chapters = course.outline.chapters;
    const completedChapters = existing.completedChapters ?? [];

    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      if (completedChapters.includes(chIdx)) continue;

      const chapterSections = chapters[chIdx].sections ?? [];
      const allDone = chapterSections.every((_, secIdx) => {
        const nodeId = buildSectionOutlineNodeKey(chIdx, secIdx);
        return completedSections.includes(nodeId);
      });

      if (allDone && chapterSections.length > 0) {
        completedChapters.push(chIdx);
      }
    }

    // Check full course completion
    const allChaptersDone = chapters.length > 0 && completedChapters.length >= chapters.length;
    const completedAt = allChaptersDone
      ? (existing.completedAt ?? new Date())
      : (existing.completedAt ?? null);

    const updatedProgress: CourseProgress = {
      currentChapter: existing.currentChapter ?? 0,
      completedChapters,
      completedSections,
      startedAt: existing.startedAt ?? new Date(),
      completedAt,
    };

    await persistCourseProgress({
      courseId,
      userId,
      progress: updatedProgress,
      existingRecordId: progressRecord?.id,
    });

    const normalizedOutline = normalizeGrowthOutline(course.outline);
    const outlineHash = computeGrowthOutlineHash(normalizedOutline);
    const completedSection = normalizedOutline.chapters
      .flatMap((chapter) =>
        chapter.sections.map((section) => ({
          chapter,
          section,
        })),
      )
      .find((item) => item.section.sectionKey === sectionNodeId);

    await ingestEvidenceEvent({
      id: crypto.randomUUID(),
      userId,
      kind: "course_progress",
      sourceType: "course",
      sourceId: courseId,
      sourceVersionHash: outlineHash,
      title: course.title,
      summary: completedSection
        ? `完成了《${completedSection.section.title}》`
        : `完成了 ${sectionNodeId}`,
      confidence: 1,
      happenedAt: new Date().toISOString(),
      metadata: {
        sectionNodeId,
        completedSectionCount: completedSections.length,
        completedChapterCount: completedChapters.length,
      },
      refs: [
        {
          refType: "section",
          refId: sectionNodeId,
          snippet: completedSection?.section.title ?? null,
          weight: 1,
        },
        ...(completedSection
          ? [
              {
                refType: "chapter",
                refId: completedSection.chapter.chapterKey,
                snippet: completedSection.chapter.title,
                weight: 1,
              },
            ]
          : []),
      ],
    });

    await aggregateCourseEventsToKnowledgeEvidence({
      userId,
      courseId,
      sourceVersionHash: outlineHash,
    });

    await enqueueGrowthRefresh(
      userId,
      courseId,
      undefined,
      `course-progress:${courseId}:${completedSections.length}:${completedChapters.length}:${sectionNodeId}`,
    );

    revalidateCourseProgressViews(userId, courseId);

    return NextResponse.json({
      ok: true,
      completedSections,
      completedChapters,
      courseCompleted: allChaptersDone,
    });
  } catch (error) {
    return handleError(error);
  }
}

const ChapterSchema = z.object({
  courseId: z.string().uuid(),
  currentChapter: z.number().int().min(0),
});

/** Persist current chapter position (called when user switches chapters) */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("未登录", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const { courseId, currentChapter } = ChapterSchema.parse(body);

    await getOwnedCourseOrThrow(userId, courseId);
    const progressRecord = await getPersistedCourseProgress(courseId);

    const existing: Partial<CourseProgress> = progressRecord ?? {};
    const updatedProgress: CourseProgress = {
      currentChapter,
      completedChapters: existing.completedChapters ?? [],
      completedSections: existing.completedSections ?? [],
      startedAt: existing.startedAt ?? new Date(),
      completedAt: existing.completedAt ?? null,
    };

    await persistCourseProgress({
      courseId,
      userId,
      progress: updatedProgress,
      existingRecordId: progressRecord?.id,
    });

    revalidateCourseProgressViews(userId, courseId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

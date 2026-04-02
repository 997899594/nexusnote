import { and, eq } from "drizzle-orm";
import { courses, db } from "@/db";
import { createLearnTrace } from "@/lib/learning/observability";

interface CourseOutlineRecord {
  courseSkillIds?: string[] | null;
  chapters?: Array<{
    title?: string | null;
    skillIds?: string[] | null;
  }>;
}

export interface ResolvedLearnContext {
  courseId: string;
  courseTitle: string;
  chapterIndex: number;
  chapterTitle: string;
  courseSkillIds: string[];
  chapterSkillIds: string[];
}

export async function resolveOwnedLearnContext({
  userId,
  courseId,
  chapterIndex,
  traceId,
}: {
  userId: string;
  courseId: string;
  chapterIndex: number;
  traceId?: string;
}): Promise<ResolvedLearnContext | null> {
  const trace = createLearnTrace(
    "resolve-context",
    {
      userId,
      courseId,
      chapterIndex,
    },
    traceId,
  );

  const [course] = await db
    .select({
      title: courses.title,
      outlineData: courses.outlineData,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  if (!course) {
    trace.finish({
      found: false,
    });
    return null;
  }

  const outline = course.outlineData as CourseOutlineRecord | null;
  const chapter = outline?.chapters?.[chapterIndex];
  const chapterTitle = chapter?.title?.trim() || `第 ${chapterIndex + 1} 章`;
  const courseSkillIds = Array.isArray(outline?.courseSkillIds)
    ? outline.courseSkillIds.filter((skillId): skillId is string => typeof skillId === "string")
    : [];
  const chapterSkillIds = Array.isArray(chapter?.skillIds)
    ? chapter.skillIds.filter((skillId): skillId is string => typeof skillId === "string")
    : [];

  trace.finish({
    found: true,
    chapterTitle,
    courseSkillCount: courseSkillIds.length,
    chapterSkillCount: chapterSkillIds.length,
  });

  return {
    courseId,
    courseTitle: course.title,
    chapterIndex,
    chapterTitle,
    courseSkillIds,
    chapterSkillIds,
  };
}

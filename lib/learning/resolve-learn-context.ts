import { and, eq } from "drizzle-orm";
import { courses, db } from "@/db";

interface CourseOutlineRecord {
  chapters?: Array<{
    title?: string | null;
  }>;
}

export interface ResolvedLearnContext {
  courseId: string;
  courseTitle: string;
  chapterIndex: number;
  chapterTitle: string;
}

export async function resolveOwnedLearnContext({
  userId,
  courseId,
  chapterIndex,
}: {
  userId: string;
  courseId: string;
  chapterIndex: number;
}): Promise<ResolvedLearnContext | null> {
  const [course] = await db
    .select({
      title: courses.title,
      outlineData: courses.outlineData,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  if (!course) {
    return null;
  }

  const outline = course.outlineData as CourseOutlineRecord | null;
  const chapter = outline?.chapters?.[chapterIndex];
  const chapterTitle = chapter?.title?.trim() || `第 ${chapterIndex + 1} 章`;

  return {
    courseId,
    courseTitle: course.title,
    chapterIndex,
    chapterTitle,
  };
}

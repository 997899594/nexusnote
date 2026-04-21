import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { courseProgress, courses, db } from "@/db";
import { getRecentCoursesTag } from "@/lib/cache/tags";

export type RecentItem = {
  id: string;
  type: "course";
  title: string;
  desc: string;
  time: string;
  url: string;
  sortAt: number;
};

type RecentCourseRow = {
  id: string;
  title: string | null;
  description: string | null;
  updatedAt: Date | null;
};

type ProgressRow = {
  courseId: string;
  currentChapter: number | null;
};

function formatTime(date: Date | null): string {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function formatProgress(currentChapter: number): string {
  return currentChapter > 0 ? `第${currentChapter + 1}章` : "未开始";
}

function buildProgressMap(rows: ProgressRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.courseId, row.currentChapter ?? 0]));
}

function buildRecentItem(
  course: RecentCourseRow,
  progressByCourseId: Map<string, number>,
): RecentItem {
  const currentChapter = progressByCourseId.get(course.id) ?? 0;

  return {
    id: course.id,
    type: "course",
    title: course.title || "未命名课程",
    desc: course.description?.slice(0, 30) || formatProgress(currentChapter),
    time: formatTime(course.updatedAt),
    url: `/learn/${course.id}`,
    sortAt: course.updatedAt?.getTime() ?? 0,
  };
}

export async function getRecentItemsCached(userId: string, limit = 6): Promise<RecentItem[]> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getRecentCoursesTag(userId));

  const [recentCourses, progressRows] = await Promise.all([
    db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(eq(courses.userId, userId))
      .orderBy(desc(courses.updatedAt))
      .limit(limit),

    db
      .select({
        courseId: courseProgress.courseId,
        currentChapter: courseProgress.currentChapter,
      })
      .from(courseProgress)
      .where(eq(courseProgress.userId, userId)),
  ]);

  const progressByCourseId = buildProgressMap(progressRows);

  return recentCourses.map((course) => buildRecentItem(course, progressByCourseId));
}

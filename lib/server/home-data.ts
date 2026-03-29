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

function formatTime(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export async function getRecentItemsCached(userId: string, limit = 6): Promise<RecentItem[]> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getRecentCoursesTag(userId));

  const recentCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(eq(courses.userId, userId))
    .orderBy(desc(courses.updatedAt))
    .limit(limit);

  const progressRows = await db
    .select({
      courseId: courseProgress.courseId,
      currentChapter: courseProgress.currentChapter,
    })
    .from(courseProgress)
    .where(eq(courseProgress.userId, userId));

  return recentCourses.map((course) => {
    const progressData = progressRows.find((row) => row.courseId === course.id);
    const currentChapter = progressData?.currentChapter || 0;
    const progress = currentChapter > 0 ? `第${currentChapter + 1}章` : "未开始";

    return {
      id: course.id,
      type: "course",
      title: course.title || "未命名课程",
      desc: course.description?.slice(0, 30) || progress,
      time: formatTime(course.updatedAt),
      url: `/learn/${course.id}`,
      sortAt: course.updatedAt?.getTime() ?? 0,
    };
  });
}

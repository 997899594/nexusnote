import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getProfileStatsTag } from "@/lib/cache/tags";
import {
  getRecentLearningItemsCached,
  type RecentLearningItem,
} from "@/lib/learning/recent-courses-data";
import { getUserProfileOverviewCached, type ProfileOverview } from "@/lib/profile/stats-data";

export interface ProfileHomePrimaryLearningEntry {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface ProfileHomeData {
  overview: ProfileOverview;
  primaryLearningEntry: ProfileHomePrimaryLearningEntry;
}

function buildPrimaryLearningEntry(
  primaryCourse: RecentLearningItem | null,
): ProfileHomePrimaryLearningEntry {
  if (!primaryCourse) {
    return {
      title: "还没有可继续的学习记录",
      description: "从一次课程访谈开始，生成第一门课后，这里就会成为你的学习起点。",
      href: "/interview",
      cta: "开始课程访谈",
    };
  }

  return {
    title: primaryCourse.title,
    description:
      primaryCourse.status === "completed"
        ? "课程已完成，可以回看内容、笔记和学习对话。"
        : primaryCourse.nextSectionTitle
          ? `下一篇：${primaryCourse.nextSectionTitle}`
          : "从第一篇内容开始学习。",
    href: primaryCourse.url,
    cta:
      primaryCourse.status === "completed"
        ? "查看课程"
        : primaryCourse.status === "not_started"
          ? "开始学习"
          : "继续学习",
  };
}

export async function getProfileHomeDataCached(userId: string): Promise<ProfileHomeData> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));

  const [overview, recentCourses] = await Promise.all([
    getUserProfileOverviewCached(userId),
    getRecentLearningItemsCached(userId, 1),
  ]);
  const primaryCourse = recentCourses[0] ?? null;

  return {
    overview,
    primaryLearningEntry: buildPrimaryLearningEntry(primaryCourse),
  };
}

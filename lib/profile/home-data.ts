import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getProfileStatsTag } from "@/lib/cache/tags";
import { getRecentItemsCached, type RecentItem } from "@/lib/learning/recent-courses-data";
import {
  getUserProfileOverviewCached,
  type ProfileOverview,
  type ProfileRecentActivityItem,
} from "@/lib/profile/stats-data";

export interface ProfileHomePrimaryLearningEntry {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface ProfileHomeData {
  overview: ProfileOverview;
  primaryLearningEntry: ProfileHomePrimaryLearningEntry;
  secondaryActivities: ProfileRecentActivityItem[];
}

function buildPrimaryLearningEntry(
  primaryCourse: RecentItem | null,
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
    description: primaryCourse.desc
      ? `${primaryCourse.desc}。从这里继续学习。`
      : "从上次停下的地方继续学习。",
    href: primaryCourse.url,
    cta: "继续学习",
  };
}

export async function getProfileHomeDataCached(userId: string): Promise<ProfileHomeData> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));

  const [overview, recentCourses] = await Promise.all([
    getUserProfileOverviewCached(userId),
    getRecentItemsCached(userId, 1),
  ]);
  const primaryCourse = recentCourses[0] ?? null;

  return {
    overview,
    primaryLearningEntry: buildPrimaryLearningEntry(primaryCourse),
    secondaryActivities: overview.recentActivity.slice(1, 4),
  };
}

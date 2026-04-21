import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getProfileStatsTag } from "@/lib/cache/tags";
import { formatProfileActivityTime } from "@/lib/profile/presentation";
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
  primaryActivity: ProfileRecentActivityItem | null,
): ProfileHomePrimaryLearningEntry {
  if (!primaryActivity) {
    return {
      title: "还没有可继续的学习记录",
      description: "从一次课程访谈开始，生成第一门课后，这里就会成为你的学习起点。",
      href: "/interview",
      cta: "开始课程访谈",
    };
  }

  return {
    title: primaryActivity.title,
    description: `上次更新于 ${formatProfileActivityTime(primaryActivity.updatedAt)}。从这里继续，不需要先翻整页记录。`,
    href: `/chat/${primaryActivity.id}`,
    cta: "继续这次对话",
  };
}

export async function getProfileHomeDataCached(userId: string): Promise<ProfileHomeData> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));

  const overview = await getUserProfileOverviewCached(userId);
  const primaryActivity = overview.recentActivity[0] ?? null;

  return {
    overview,
    primaryLearningEntry: buildPrimaryLearningEntry(primaryActivity),
    secondaryActivities: overview.recentActivity.slice(1, 4),
  };
}

import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getCareerTreesTag, getNotesIndexTag, getProfileStatsTag } from "@/lib/cache/tags";
import { listUserKnowledgeInsights } from "@/lib/knowledge/insights";

export async function getTopKnowledgeInsightsCached(userId: string, limit = 4) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));
  cacheTag(getNotesIndexTag(userId));

  return listUserKnowledgeInsights(userId, limit);
}

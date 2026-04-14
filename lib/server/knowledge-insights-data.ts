import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getGoldenPathTag, getNotesIndexTag, getProfileStatsTag } from "@/lib/cache/tags";
import { listUserKnowledgeInsights } from "@/lib/knowledge/insights";

export async function getTopKnowledgeInsightsCached(userId: string, limit = 4) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getGoldenPathTag(userId));
  cacheTag(getProfileStatsTag(userId));
  cacheTag(getNotesIndexTag(userId));

  const rows = await listUserKnowledgeInsights(userId);
  return rows.slice(0, limit);
}

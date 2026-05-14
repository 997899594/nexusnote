import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getCareerTreesTag, getNotesIndexTag, getProfileStatsTag } from "@/lib/cache/tags";
import { getLatestFocusSnapshot, getLatestProfileSnapshot } from "@/lib/growth/projection-data";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/growth/projection-types";
import { getGrowthSnapshot } from "@/lib/growth/snapshot-data";
import type { CareerTreeSnapshot } from "@/lib/growth/types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { listUserKnowledgeInsights } from "@/lib/knowledge/insights";

export interface GrowthWorkspaceData {
  snapshot: CareerTreeSnapshot;
  focusSnapshot: FocusSnapshotProjection | null;
  profileSnapshot: ProfileSnapshotProjection | null;
  insights: KnowledgeInsight[];
}

function applyGrowthWorkspaceCacheTags(userId: string): void {
  cacheLife("minutes");
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));
  cacheTag(getNotesIndexTag(userId));
}

async function loadGrowthWorkspaceData(
  userId: string,
  insightLimit: number,
): Promise<GrowthWorkspaceData> {
  const [snapshot, focusSnapshot, profileSnapshot, insights] = await Promise.all([
    getGrowthSnapshot(userId),
    getLatestFocusSnapshot(userId),
    getLatestProfileSnapshot(userId),
    listUserKnowledgeInsights(userId, insightLimit),
  ]);

  return {
    snapshot,
    focusSnapshot,
    profileSnapshot,
    insights,
  };
}

export async function getGrowthWorkspaceDataCached(
  userId: string,
  insightLimit = 4,
): Promise<GrowthWorkspaceData> {
  "use cache";

  applyGrowthWorkspaceCacheTags(userId);

  return loadGrowthWorkspaceData(userId, insightLimit);
}

export async function getGrowthWorkspaceDataFresh(
  userId: string,
  insightLimit = 4,
): Promise<GrowthWorkspaceData> {
  return loadGrowthWorkspaceData(userId, insightLimit);
}

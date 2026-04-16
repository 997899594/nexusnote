import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getCareerTreesTag, getProfileStatsTag } from "@/lib/cache/tags";
import { getLatestFocusSnapshot, getLatestProfileSnapshot } from "@/lib/growth/projection-data";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/growth/projection-types";

function buildProjectionTags(userId: string) {
  cacheLife("minutes");
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));
}

export async function getLatestFocusSnapshotCached(
  userId: string,
): Promise<FocusSnapshotProjection | null> {
  "use cache";

  buildProjectionTags(userId);
  return getLatestFocusSnapshot(userId);
}

export async function getLatestProfileSnapshotCached(
  userId: string,
): Promise<ProfileSnapshotProjection | null> {
  "use cache";

  buildProjectionTags(userId);
  return getLatestProfileSnapshot(userId);
}

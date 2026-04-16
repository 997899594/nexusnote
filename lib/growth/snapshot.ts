import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getCareerTreesTag } from "@/lib/cache/tags";
import { getGrowthSnapshot } from "@/lib/growth/snapshot-data";
import type { CareerTreeSnapshot } from "@/lib/growth/types";

export async function getGrowthSnapshotCached(userId: string): Promise<CareerTreeSnapshot> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getCareerTreesTag(userId));

  return getGrowthSnapshot(userId);
}

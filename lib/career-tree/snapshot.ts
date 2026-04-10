import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { careerUserTreeSnapshots, courses, db } from "@/db";
import { getGoldenPathTag } from "@/lib/cache/tags";
import { getCareerTreePreference } from "@/lib/career-tree/preferences";
import {
  createEmptyGoldenPathSnapshot,
  createPendingGoldenPathSnapshot,
  type GoldenPathSnapshot,
  goldenPathSnapshotSchema,
} from "@/lib/career-tree/types";

async function getSavedCourseCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.userId, userId))
    .limit(1);

  return rows.length;
}

export async function getCareerTreeSnapshot(userId: string): Promise<GoldenPathSnapshot> {
  const [savedCourseCount, preference, latestSnapshot] = await Promise.all([
    getSavedCourseCount(userId),
    getCareerTreePreference(userId),
    db.query.careerUserTreeSnapshots.findFirst({
      where: and(
        eq(careerUserTreeSnapshots.userId, userId),
        eq(careerUserTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(careerUserTreeSnapshots.createdAt),
    }),
  ]);

  if (savedCourseCount === 0) {
    return createEmptyGoldenPathSnapshot();
  }

  if (!latestSnapshot) {
    return createPendingGoldenPathSnapshot(preference.selectedDirectionKey);
  }

  const parsed = goldenPathSnapshotSchema.safeParse(latestSnapshot.payload);
  if (!parsed.success) {
    return createPendingGoldenPathSnapshot(preference.selectedDirectionKey);
  }

  return {
    ...parsed.data,
    selectedDirectionKey: preference.selectedDirectionKey ?? parsed.data.selectedDirectionKey,
  };
}

export async function getCareerTreeSnapshotCached(userId: string): Promise<GoldenPathSnapshot> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getGoldenPathTag(userId));

  return getCareerTreeSnapshot(userId);
}

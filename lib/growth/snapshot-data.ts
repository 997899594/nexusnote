import { and, desc, eq } from "drizzle-orm";
import { courses, db, userCareerTreeSnapshots } from "@/db";
import { getGrowthPreference } from "@/lib/growth/preferences";
import {
  type CareerTreeSnapshot,
  careerTreeSnapshotSchema,
  createEmptyCareerTreeSnapshot,
  createPendingCareerTreeSnapshot,
} from "@/lib/growth/types";

async function getSavedCourseCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.userId, userId))
    .limit(1);

  return rows.length;
}

export async function getGrowthSnapshot(userId: string): Promise<CareerTreeSnapshot> {
  const [savedCourseCount, preference, latestSnapshot] = await Promise.all([
    getSavedCourseCount(userId),
    getGrowthPreference(userId),
    db.query.userCareerTreeSnapshots.findFirst({
      where: and(
        eq(userCareerTreeSnapshots.userId, userId),
        eq(userCareerTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(userCareerTreeSnapshots.createdAt),
    }),
  ]);

  if (savedCourseCount === 0) {
    return createEmptyCareerTreeSnapshot();
  }

  if (!latestSnapshot) {
    return createPendingCareerTreeSnapshot(preference.selectedDirectionKey);
  }

  const parsed = careerTreeSnapshotSchema.safeParse(latestSnapshot.payload);
  if (!parsed.success) {
    return createPendingCareerTreeSnapshot(preference.selectedDirectionKey);
  }

  return {
    ...parsed.data,
    selectedDirectionKey: preference.selectedDirectionKey ?? parsed.data.selectedDirectionKey,
  };
}

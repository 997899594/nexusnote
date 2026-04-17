import { and, desc, eq } from "drizzle-orm";
import { courses, db, userCareerTreeSnapshots } from "@/db";
import { getGrowthPreference } from "@/lib/growth/preferences";
import {
  type CareerTreeSnapshot,
  careerTreeSnapshotSchema,
  createEmptyCareerTreeSnapshot,
  createPendingCareerTreeSnapshot,
} from "@/lib/growth/types";

async function hasSavedCourse(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.userId, userId))
    .limit(1);

  return rows.length > 0;
}

export async function getLatestCareerTreeSnapshotRow(userId: string) {
  return db.query.userCareerTreeSnapshots.findFirst({
    where: and(
      eq(userCareerTreeSnapshots.userId, userId),
      eq(userCareerTreeSnapshots.isLatest, true),
    ),
    orderBy: desc(userCareerTreeSnapshots.createdAt),
  });
}

export function parseCareerTreeSnapshotPayload(payload: unknown): CareerTreeSnapshot | null {
  const parsed = careerTreeSnapshotSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function applySelectedDirectionPreference(
  snapshot: CareerTreeSnapshot,
  selectedDirectionKey: string | null,
): CareerTreeSnapshot {
  return {
    ...snapshot,
    selectedDirectionKey: selectedDirectionKey ?? snapshot.selectedDirectionKey,
  };
}

export async function getGrowthSnapshot(userId: string): Promise<CareerTreeSnapshot> {
  const [savedCourseExists, preference, latestSnapshot] = await Promise.all([
    hasSavedCourse(userId),
    getGrowthPreference(userId),
    getLatestCareerTreeSnapshotRow(userId),
  ]);

  if (!savedCourseExists) {
    return createEmptyCareerTreeSnapshot();
  }

  if (!latestSnapshot) {
    return createPendingCareerTreeSnapshot(preference.selectedDirectionKey);
  }

  const parsedSnapshot = parseCareerTreeSnapshotPayload(latestSnapshot.payload);
  if (!parsedSnapshot) {
    return createPendingCareerTreeSnapshot(preference.selectedDirectionKey);
  }

  return applySelectedDirectionPreference(parsedSnapshot, preference.selectedDirectionKey);
}

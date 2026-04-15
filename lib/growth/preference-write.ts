import { eq } from "drizzle-orm";
import { db, userCareerTreePreferences } from "@/db";

export async function setSelectedGrowthDirection(
  userId: string,
  selectedDirectionKey: string,
): Promise<void> {
  const existing = await db.query.userCareerTreePreferences.findFirst({
    where: eq(userCareerTreePreferences.userId, userId),
  });

  if (existing) {
    await db
      .update(userCareerTreePreferences)
      .set({
        selectedDirectionKey,
        selectionCount: existing.selectionCount + 1,
        preferenceVersion: existing.preferenceVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(userCareerTreePreferences.userId, userId));
    return;
  }

  await db.insert(userCareerTreePreferences).values({
    userId,
    selectedDirectionKey,
    selectionCount: 1,
    preferenceVersion: 1,
    updatedAt: new Date(),
  });
}

import { eq } from "drizzle-orm";
import { careerUserTreePreferences, db } from "@/db";

export async function setSelectedCareerTreeDirection(
  userId: string,
  selectedDirectionKey: string,
): Promise<void> {
  const existing = await db.query.careerUserTreePreferences.findFirst({
    where: eq(careerUserTreePreferences.userId, userId),
  });

  if (existing) {
    await db
      .update(careerUserTreePreferences)
      .set({
        selectedDirectionKey,
        selectionCount: existing.selectionCount + 1,
        preferenceVersion: existing.preferenceVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(careerUserTreePreferences.userId, userId));
    return;
  }

  await db.insert(careerUserTreePreferences).values({
    userId,
    selectedDirectionKey,
    selectionCount: 1,
    preferenceVersion: 1,
    updatedAt: new Date(),
  });
}

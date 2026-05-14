import { eq } from "drizzle-orm";
import { careerUserTreePreferences, db } from "@/db";

export interface CareerTreePreference {
  selectedDirectionKey: string | null;
  preferenceVersion: number;
  selectionCount: number;
}

export async function getCareerTreePreferenceRow(userId: string) {
  return db.query.careerUserTreePreferences.findFirst({
    where: eq(careerUserTreePreferences.userId, userId),
  });
}

export async function getCareerTreePreference(userId: string): Promise<CareerTreePreference> {
  const preference = await getCareerTreePreferenceRow(userId);

  return {
    selectedDirectionKey: preference?.selectedDirectionKey ?? null,
    preferenceVersion: preference?.preferenceVersion ?? 0,
    selectionCount: preference?.selectionCount ?? 0,
  };
}

export async function setSelectedCareerTreeDirection(
  userId: string,
  selectedDirectionKey: string,
): Promise<void> {
  const existing = await getCareerTreePreferenceRow(userId);

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

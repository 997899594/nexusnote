import { eq } from "drizzle-orm";
import { db, userGoldenPathPreferences } from "@/db";

export interface GoldenPathPreference {
  currentRouteId: string | null;
  lastConfirmedAt: Date | null;
}

export async function getUserGoldenPathPreference(userId: string): Promise<GoldenPathPreference> {
  const preference = await db.query.userGoldenPathPreferences.findFirst({
    where: eq(userGoldenPathPreferences.userId, userId),
  });

  return {
    currentRouteId: preference?.currentRouteId ?? null,
    lastConfirmedAt: preference?.lastConfirmedAt ?? null,
  };
}

export async function setUserGoldenPathPreference(
  userId: string,
  currentRouteId: string,
): Promise<void> {
  const existing = await db.query.userGoldenPathPreferences.findFirst({
    where: eq(userGoldenPathPreferences.userId, userId),
  });

  if (existing) {
    await db
      .update(userGoldenPathPreferences)
      .set({
        currentRouteId,
        lastConfirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userGoldenPathPreferences.id, existing.id));
    return;
  }

  await db.insert(userGoldenPathPreferences).values({
    userId,
    currentRouteId,
    lastConfirmedAt: new Date(),
  });
}

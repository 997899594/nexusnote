import { eq } from "drizzle-orm";
import { db, userCareerTreePreferences } from "@/db";

export interface GrowthPreference {
  selectedDirectionKey: string | null;
  preferenceVersion: number;
}

export async function getGrowthPreference(userId: string): Promise<GrowthPreference> {
  const preference = await db.query.userCareerTreePreferences.findFirst({
    where: eq(userCareerTreePreferences.userId, userId),
  });

  return {
    selectedDirectionKey: preference?.selectedDirectionKey ?? null,
    preferenceVersion: preference?.preferenceVersion ?? 0,
  };
}

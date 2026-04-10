import { eq } from "drizzle-orm";
import { careerUserTreePreferences, db } from "@/db";

export interface CareerTreePreference {
  selectedDirectionKey: string | null;
  preferenceVersion: number;
}

export async function getCareerTreePreference(userId: string): Promise<CareerTreePreference> {
  const preference = await db.query.careerUserTreePreferences.findFirst({
    where: eq(careerUserTreePreferences.userId, userId),
  });

  return {
    selectedDirectionKey: preference?.selectedDirectionKey ?? null,
    preferenceVersion: preference?.preferenceVersion ?? 0,
  };
}

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, knowledgeEvidenceEvents, userCareerTreePreferences } from "@/db";

export interface GrowthDirectionPreferenceSignal {
  directionKey: string;
  selectionCount: number;
  latestSelectedAt: string;
}

export interface GrowthPreference {
  selectedDirectionKey: string | null;
  preferenceVersion: number;
  selectionCount: number;
  directionSignals: GrowthDirectionPreferenceSignal[];
}

export async function getGrowthPreferenceRow(userId: string) {
  return db.query.userCareerTreePreferences.findFirst({
    where: eq(userCareerTreePreferences.userId, userId),
  });
}

export async function setSelectedGrowthDirection(
  userId: string,
  selectedDirectionKey: string,
): Promise<void> {
  const existing = await getGrowthPreferenceRow(userId);

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

export async function getGrowthPreference(userId: string): Promise<GrowthPreference> {
  const [preference, directionSignalRows] = await Promise.all([
    getGrowthPreferenceRow(userId),
    db
      .select({
        directionKey: knowledgeEvidenceEvents.sourceId,
        selectionCount: sql<number>`count(*)::int`,
        latestSelectedAt: sql<string>`max(${knowledgeEvidenceEvents.happenedAt})::text`,
      })
      .from(knowledgeEvidenceEvents)
      .where(
        and(
          eq(knowledgeEvidenceEvents.userId, userId),
          eq(knowledgeEvidenceEvents.sourceType, "growth_preference"),
          isNotNull(knowledgeEvidenceEvents.sourceId),
        ),
      )
      .groupBy(knowledgeEvidenceEvents.sourceId)
      .orderBy(
        desc(sql<number>`count(*)::int`),
        desc(sql<string>`max(${knowledgeEvidenceEvents.happenedAt})::text`),
      ),
  ]);

  const directionSignals = directionSignalRows
    .filter(
      (
        row,
      ): row is {
        directionKey: string;
        selectionCount: number;
        latestSelectedAt: string;
      } =>
        typeof row.directionKey === "string" &&
        row.directionKey.length > 0 &&
        typeof row.latestSelectedAt === "string" &&
        row.latestSelectedAt.length > 0,
    )
    .map((row) => ({
      directionKey: row.directionKey,
      selectionCount: row.selectionCount,
      latestSelectedAt: row.latestSelectedAt,
    }));

  return {
    selectedDirectionKey: preference?.selectedDirectionKey ?? null,
    preferenceVersion: preference?.preferenceVersion ?? 0,
    selectionCount: preference?.selectionCount ?? 0,
    directionSignals,
  };
}

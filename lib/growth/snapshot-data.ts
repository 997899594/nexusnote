import { and, desc, eq } from "drizzle-orm";
import { courses, db, knowledgeGenerationRuns, userCareerTreeSnapshots } from "@/db";
import { CAREER_TREE_SCHEMA_VERSION, GROWTH_COMPOSE_PROMPT_VERSION } from "@/lib/growth/constants";
import { getGrowthPreference } from "@/lib/growth/preferences";
import {
  type CareerTreeSnapshot,
  careerTreeSnapshotSchema,
  createEmptyCareerTreeSnapshot,
  createPendingCareerTreeSnapshot,
} from "@/lib/growth/types";

const CURRENT_SNAPSHOT_CANDIDATE_LIMIT = 20;

async function hasSavedCourse(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.userId, userId))
    .limit(1);

  return rows.length > 0;
}

export async function getLatestRawCareerTreeSnapshotRow(userId: string) {
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

function isCurrentReadySnapshot(row: {
  snapshot: typeof userCareerTreeSnapshots.$inferSelect;
  promptVersion: string | null;
  runStatus: string | null;
}): boolean {
  if (
    row.snapshot.schemaVersion !== CAREER_TREE_SCHEMA_VERSION ||
    row.snapshot.status !== "ready" ||
    row.promptVersion !== GROWTH_COMPOSE_PROMPT_VERSION ||
    row.runStatus !== "succeeded"
  ) {
    return false;
  }

  const payload = parseCareerTreeSnapshotPayload(row.snapshot.payload);
  return payload?.status === "ready" && payload.trees.length > 0;
}

async function getRecentCareerTreeSnapshotRows(userId: string) {
  return db
    .select({
      snapshot: userCareerTreeSnapshots,
      promptVersion: knowledgeGenerationRuns.promptVersion,
      runStatus: knowledgeGenerationRuns.status,
    })
    .from(userCareerTreeSnapshots)
    .leftJoin(
      knowledgeGenerationRuns,
      eq(userCareerTreeSnapshots.composeRunId, knowledgeGenerationRuns.id),
    )
    .where(
      and(
        eq(userCareerTreeSnapshots.userId, userId),
        eq(userCareerTreeSnapshots.schemaVersion, CAREER_TREE_SCHEMA_VERSION),
        eq(userCareerTreeSnapshots.status, "ready"),
        eq(knowledgeGenerationRuns.promptVersion, GROWTH_COMPOSE_PROMPT_VERSION),
        eq(knowledgeGenerationRuns.status, "succeeded"),
      ),
    )
    .orderBy(desc(userCareerTreeSnapshots.createdAt))
    .limit(CURRENT_SNAPSHOT_CANDIDATE_LIMIT);
}

export async function getLatestCareerTreeSnapshotRow(userId: string) {
  const rows = await getRecentCareerTreeSnapshotRows(userId);
  return rows.find(isCurrentReadySnapshot)?.snapshot ?? null;
}

export async function restoreLatestCareerTreeSnapshotForComposeRun(params: {
  userId: string;
  composeRunId: string;
}) {
  const rows = await db
    .select({
      snapshot: userCareerTreeSnapshots,
      promptVersion: knowledgeGenerationRuns.promptVersion,
      runStatus: knowledgeGenerationRuns.status,
    })
    .from(userCareerTreeSnapshots)
    .leftJoin(
      knowledgeGenerationRuns,
      eq(userCareerTreeSnapshots.composeRunId, knowledgeGenerationRuns.id),
    )
    .where(
      and(
        eq(userCareerTreeSnapshots.userId, params.userId),
        eq(userCareerTreeSnapshots.composeRunId, params.composeRunId),
        eq(userCareerTreeSnapshots.schemaVersion, CAREER_TREE_SCHEMA_VERSION),
        eq(userCareerTreeSnapshots.status, "ready"),
        eq(knowledgeGenerationRuns.promptVersion, GROWTH_COMPOSE_PROMPT_VERSION),
        eq(knowledgeGenerationRuns.status, "succeeded"),
      ),
    )
    .orderBy(desc(userCareerTreeSnapshots.createdAt));

  const compatibleSnapshot = rows.find(isCurrentReadySnapshot)?.snapshot;
  if (!compatibleSnapshot) {
    return null;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(userCareerTreeSnapshots)
      .set({ isLatest: false })
      .where(
        and(
          eq(userCareerTreeSnapshots.userId, params.userId),
          eq(userCareerTreeSnapshots.isLatest, true),
        ),
      );

    await tx
      .update(userCareerTreeSnapshots)
      .set({ isLatest: true })
      .where(eq(userCareerTreeSnapshots.id, compatibleSnapshot.id));
  });

  return {
    ...compatibleSnapshot,
    isLatest: true,
  };
}

function applySelectedDirectionPreference(
  snapshot: CareerTreeSnapshot,
  selectedDirectionKey: string | null,
): CareerTreeSnapshot {
  const snapshotDirectionKeys = new Set(snapshot.trees.map((tree) => tree.directionKey));
  const validPreferenceDirectionKey =
    selectedDirectionKey && snapshotDirectionKeys.has(selectedDirectionKey)
      ? selectedDirectionKey
      : null;
  const validSnapshotDirectionKey =
    snapshot.selectedDirectionKey && snapshotDirectionKeys.has(snapshot.selectedDirectionKey)
      ? snapshot.selectedDirectionKey
      : null;

  return {
    ...snapshot,
    selectedDirectionKey: validPreferenceDirectionKey ?? validSnapshotDirectionKey,
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

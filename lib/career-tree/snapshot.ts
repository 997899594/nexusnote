import { and, desc, eq } from "drizzle-orm";
import { careerGenerationRuns, careerUserTreeSnapshots, db } from "@/db";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_SCHEMA_VERSION,
} from "@/lib/career-tree/constants";
import { getCareerTreePreference } from "@/lib/career-tree/preferences";
import { hasEligibleCareerCourses } from "@/lib/career-tree/source";
import {
  type CareerTreeSnapshot,
  careerTreeSnapshotSchema,
  createEmptyCareerTreeSnapshot,
  createPendingCareerTreeSnapshot,
} from "@/lib/career-tree/types";

const CURRENT_SNAPSHOT_CANDIDATE_LIMIT = 20;

export function parseCareerTreeSnapshotPayload(payload: unknown): CareerTreeSnapshot | null {
  const parsed = careerTreeSnapshotSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function isCurrentReadySnapshot(row: {
  snapshot: typeof careerUserTreeSnapshots.$inferSelect;
  promptVersion: string | null;
  runStatus: string | null;
}): boolean {
  if (
    row.snapshot.schemaVersion !== CAREER_TREE_SCHEMA_VERSION ||
    row.snapshot.status !== "ready" ||
    row.promptVersion !== CAREER_TREE_COMPOSE_PROMPT_VERSION ||
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
      snapshot: careerUserTreeSnapshots,
      promptVersion: careerGenerationRuns.promptVersion,
      runStatus: careerGenerationRuns.status,
    })
    .from(careerUserTreeSnapshots)
    .leftJoin(
      careerGenerationRuns,
      eq(careerUserTreeSnapshots.composeRunId, careerGenerationRuns.id),
    )
    .where(
      and(
        eq(careerUserTreeSnapshots.userId, userId),
        eq(careerUserTreeSnapshots.schemaVersion, CAREER_TREE_SCHEMA_VERSION),
        eq(careerUserTreeSnapshots.status, "ready"),
        eq(careerGenerationRuns.promptVersion, CAREER_TREE_COMPOSE_PROMPT_VERSION),
        eq(careerGenerationRuns.status, "succeeded"),
      ),
    )
    .orderBy(desc(careerUserTreeSnapshots.createdAt))
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
      snapshot: careerUserTreeSnapshots,
      promptVersion: careerGenerationRuns.promptVersion,
      runStatus: careerGenerationRuns.status,
    })
    .from(careerUserTreeSnapshots)
    .leftJoin(
      careerGenerationRuns,
      eq(careerUserTreeSnapshots.composeRunId, careerGenerationRuns.id),
    )
    .where(
      and(
        eq(careerUserTreeSnapshots.userId, params.userId),
        eq(careerUserTreeSnapshots.composeRunId, params.composeRunId),
        eq(careerUserTreeSnapshots.schemaVersion, CAREER_TREE_SCHEMA_VERSION),
        eq(careerUserTreeSnapshots.status, "ready"),
        eq(careerGenerationRuns.promptVersion, CAREER_TREE_COMPOSE_PROMPT_VERSION),
        eq(careerGenerationRuns.status, "succeeded"),
      ),
    )
    .orderBy(desc(careerUserTreeSnapshots.createdAt));

  const compatibleSnapshot = rows.find(isCurrentReadySnapshot)?.snapshot;
  if (!compatibleSnapshot) {
    return null;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(careerUserTreeSnapshots)
      .set({ isLatest: false })
      .where(
        and(
          eq(careerUserTreeSnapshots.userId, params.userId),
          eq(careerUserTreeSnapshots.isLatest, true),
        ),
      );

    await tx
      .update(careerUserTreeSnapshots)
      .set({ isLatest: true })
      .where(eq(careerUserTreeSnapshots.id, compatibleSnapshot.id));
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

export async function getCareerTreeSnapshot(userId: string): Promise<CareerTreeSnapshot> {
  const [eligibleCoursesExist, preference, latestSnapshot] = await Promise.all([
    hasEligibleCareerCourses(userId),
    getCareerTreePreference(userId),
    getLatestCareerTreeSnapshotRow(userId),
  ]);

  if (!eligibleCoursesExist) {
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

import { and, desc, eq, inArray } from "drizzle-orm";
import { careerGenerationRuns, careerUserTreeSnapshots, db } from "@/db";
import { getModelNameForPolicy } from "@/lib/ai/core/model-policy";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_EXTRACT_PROMPT_VERSION,
  CAREER_TREE_MERGE_PROMPT_VERSION,
  CAREER_TREE_SCHEMA_VERSION,
} from "@/lib/career-tree/constants";
import { getCareerTreePreference } from "@/lib/career-tree/preferences";
import { hasEligibleCareerCourses } from "@/lib/career-tree/source";
import {
  type CareerTreeSnapshot,
  careerTreeSnapshotSchema,
  createEmptyCareerTreeSnapshot,
  createFailedCareerTreeSnapshot,
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

async function getLatestUnsuccessfulCareerRun(userId: string) {
  return db.query.careerGenerationRuns.findFirst({
    where: and(
      eq(careerGenerationRuns.userId, userId),
      inArray(careerGenerationRuns.kind, ["extract", "merge", "compose"]),
      inArray(careerGenerationRuns.status, ["running", "failed"]),
    ),
    orderBy: desc(careerGenerationRuns.createdAt),
  });
}

function normalizeFailureStage(kind: string): "extract" | "merge" | "compose" {
  if (kind === "extract" || kind === "merge" || kind === "compose") {
    return kind;
  }

  return "compose";
}

function getPublicFailureMessage(message: string | null): string {
  if (!message) {
    return "职业树生成失败。";
  }

  if (/bad request/i.test(message)) {
    return "模型请求格式不被当前供应商接受。";
  }

  if (/timed out|timeout/i.test(message)) {
    return "模型生成超时。";
  }

  if (/unknown|anchorRef|supporting refs|node ref/i.test(message)) {
    return "模型返回的职业树结构没有通过校验。";
  }

  return message.slice(0, 240);
}

function shouldSurfaceCareerRunFailure(run: {
  kind: string;
  status: string;
  model: string;
  promptVersion: string;
}): boolean {
  if (run.status !== "failed") {
    return false;
  }

  if (run.kind === "extract") {
    return (
      run.promptVersion === CAREER_TREE_EXTRACT_PROMPT_VERSION &&
      run.model === getModelNameForPolicy("extract-fast")
    );
  }

  if (run.kind === "merge") {
    return (
      run.promptVersion === CAREER_TREE_MERGE_PROMPT_VERSION &&
      run.model === getModelNameForPolicy("extract-fast")
    );
  }

  if (run.kind === "compose") {
    return (
      run.promptVersion === CAREER_TREE_COMPOSE_PROMPT_VERSION &&
      run.model === getModelNameForPolicy("outline-architect", { modelSeries: "openai" })
    );
  }

  return false;
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
        eq(careerGenerationRuns.status, "succeeded"),
      ),
    )
    .orderBy(desc(careerUserTreeSnapshots.createdAt));

  const currentSnapshot = rows.find(isCurrentReadySnapshot)?.snapshot;
  if (!currentSnapshot) {
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
      .where(eq(careerUserTreeSnapshots.id, currentSnapshot.id));
  });

  return {
    ...currentSnapshot,
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
  const [eligibleCoursesExist, preference, latestSnapshot, latestRun] = await Promise.all([
    hasEligibleCareerCourses(userId),
    getCareerTreePreference(userId),
    getLatestCareerTreeSnapshotRow(userId),
    getLatestUnsuccessfulCareerRun(userId),
  ]);

  if (!eligibleCoursesExist) {
    return createEmptyCareerTreeSnapshot();
  }

  if (latestSnapshot) {
    const parsedSnapshot = parseCareerTreeSnapshotPayload(latestSnapshot.payload);
    if (parsedSnapshot) {
      return applySelectedDirectionPreference(parsedSnapshot, preference.selectedDirectionKey);
    }
  }

  if (latestRun?.status === "failed" && shouldSurfaceCareerRunFailure(latestRun)) {
    return createFailedCareerTreeSnapshot({
      selectedDirectionKey: preference.selectedDirectionKey,
      stage: normalizeFailureStage(latestRun.kind),
      message: getPublicFailureMessage(latestRun.errorMessage),
      failedAt: latestRun.finishedAt?.toISOString() ?? null,
    });
  }

  return createPendingCareerTreeSnapshot(preference.selectedDirectionKey);
}

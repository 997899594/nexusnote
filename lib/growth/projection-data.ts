import { and, desc, eq } from "drizzle-orm";
import { db, userFocusSnapshots, userProfileSnapshots } from "@/db";
import type {
  FocusSnapshotPayload,
  FocusSnapshotProjection,
  ProfileSnapshotPayload,
  ProfileSnapshotProjection,
} from "@/lib/growth/projection-types";
import {
  focusSnapshotPayloadSchema,
  normalizeProjectionState,
  profileSnapshotPayloadSchema,
} from "@/lib/growth/projection-types";

function parseSnapshotPayload<T>(
  payload: unknown,
  safeParse: (value: unknown) => { success: true; data: T } | { success: false },
): T | null {
  const parsed = safeParse(payload);
  return parsed.success ? parsed.data : null;
}

async function readLatestProjection<Row extends { payload: unknown }, Payload, Projection>(params: {
  loadRow: () => Promise<Row | null | undefined>;
  parsePayload: (payload: unknown) => Payload | null;
  buildProjection: (row: Row, payload: Payload) => Projection;
}): Promise<Projection | null> {
  const row = await params.loadRow();
  if (!row) {
    return null;
  }

  const payload = params.parsePayload(row.payload);
  return payload ? params.buildProjection(row, payload) : null;
}

function buildFocusSnapshotProjection(
  row: typeof userFocusSnapshots.$inferSelect,
  payload: NonNullable<ReturnType<typeof parseSnapshotPayload<FocusSnapshotPayload>>>,
): FocusSnapshotProjection {
  return {
    directionKey: row.directionKey ?? payload.directionKey,
    nodeId: payload.node?.id ?? row.nodeId ?? null,
    anchorRef: payload.node?.anchorRef ?? row.nodeId ?? null,
    title: row.title,
    summary: row.summary || payload.summary || "",
    progress: row.progress,
    state: normalizeProjectionState(row.state),
    whyThisDirection: payload.whyThisDirection,
    score: payload.score ?? null,
    node: payload.node,
  };
}

function buildProfileSnapshotProjection(
  payload: NonNullable<ReturnType<typeof parseSnapshotPayload<ProfileSnapshotPayload>>>,
): ProfileSnapshotProjection {
  return {
    recommendedDirectionKey: payload.recommendedDirectionKey,
    selectedDirectionKey: payload.selectedDirectionKey,
    treesCount: payload.treesCount,
    currentDirection: payload.currentDirection,
    metrics: payload.metrics,
    focus: payload.focus,
  };
}

export async function getLatestFocusSnapshotRow(userId: string) {
  return db.query.userFocusSnapshots.findFirst({
    where: and(eq(userFocusSnapshots.userId, userId), eq(userFocusSnapshots.isLatest, true)),
    orderBy: desc(userFocusSnapshots.createdAt),
  });
}

export async function getLatestProfileSnapshotRow(userId: string) {
  return db.query.userProfileSnapshots.findFirst({
    where: and(eq(userProfileSnapshots.userId, userId), eq(userProfileSnapshots.isLatest, true)),
    orderBy: desc(userProfileSnapshots.createdAt),
  });
}

export async function getLatestFocusSnapshot(
  userId: string,
): Promise<FocusSnapshotProjection | null> {
  return readLatestProjection({
    loadRow: () => getLatestFocusSnapshotRow(userId),
    parsePayload: (payload): FocusSnapshotPayload | null =>
      parseSnapshotPayload<FocusSnapshotPayload>(payload, focusSnapshotPayloadSchema.safeParse),
    buildProjection: buildFocusSnapshotProjection,
  });
}

export async function getLatestProfileSnapshot(
  userId: string,
): Promise<ProfileSnapshotProjection | null> {
  return readLatestProjection({
    loadRow: () => getLatestProfileSnapshotRow(userId),
    parsePayload: (payload): ProfileSnapshotPayload | null =>
      parseSnapshotPayload<ProfileSnapshotPayload>(payload, profileSnapshotPayloadSchema.safeParse),
    buildProjection: (_row, payload) => buildProfileSnapshotProjection(payload),
  });
}

import { and, desc, eq } from "drizzle-orm";
import { db, userFocusSnapshots, userProfileSnapshots } from "@/db";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/growth/projection-types";
import {
  focusSnapshotPayloadSchema,
  normalizeProjectionState,
  profileSnapshotPayloadSchema,
} from "@/lib/growth/projection-types";

export async function getLatestFocusSnapshot(
  userId: string,
): Promise<FocusSnapshotProjection | null> {
  const row = await db.query.userFocusSnapshots.findFirst({
    where: and(eq(userFocusSnapshots.userId, userId), eq(userFocusSnapshots.isLatest, true)),
    orderBy: desc(userFocusSnapshots.createdAt),
  });

  if (!row) {
    return null;
  }

  const parsed = focusSnapshotPayloadSchema.safeParse(row.payload);
  if (!parsed.success) {
    return null;
  }

  return {
    directionKey: row.directionKey ?? parsed.data.directionKey,
    nodeId: row.nodeId ?? parsed.data.node?.id ?? null,
    anchorRef: parsed.data.node?.anchorRef ?? null,
    title: row.title,
    summary: row.summary,
    progress: row.progress,
    state: normalizeProjectionState(row.state),
    whyThisDirection: parsed.data.whyThisDirection,
    node: parsed.data.node,
  };
}

export async function getLatestProfileSnapshot(
  userId: string,
): Promise<ProfileSnapshotProjection | null> {
  const row = await db.query.userProfileSnapshots.findFirst({
    where: and(eq(userProfileSnapshots.userId, userId), eq(userProfileSnapshots.isLatest, true)),
    orderBy: desc(userProfileSnapshots.createdAt),
  });

  if (!row) {
    return null;
  }

  const parsed = profileSnapshotPayloadSchema.safeParse(row.payload);
  if (!parsed.success) {
    return null;
  }

  return {
    recommendedDirectionKey: parsed.data.recommendedDirectionKey,
    selectedDirectionKey: parsed.data.selectedDirectionKey,
    treesCount: parsed.data.treesCount,
    currentDirection: parsed.data.currentDirection,
    metrics: parsed.data.metrics,
    focus: parsed.data.focus,
  };
}

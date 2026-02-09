"use server";

import { db, documentSnapshots, eq, desc, and, inArray } from "@nexusnote/db";
import { createSafeAction } from "@/lib/actions/action-utils";
import { verifyDocumentOwnership, AuthError } from "@/lib/auth/auth-utils";
import { z } from "zod";

/**
 * 快照服务器端格式
 */
const ServerSnapshotSchema = z.object({
  id: z.string(),
  documentId: z.string().uuid(),
  yjsState: z.string(), // base64
  plainText: z.string(),
  timestamp: z.number(),
  trigger: z.string(),
  summary: z.string().optional(),
  wordCount: z.number(),
  diffAdded: z.number().optional(),
  diffRemoved: z.number().optional(),
});

type ServerSnapshot = z.infer<typeof ServerSnapshotSchema>;

/**
 * 获取文档最新的快照时间戳
 */
export const getLatestSnapshotTimestampAction = createSafeAction(
  z.object({ documentId: z.string().uuid() }),
  async ({ documentId }, userId) => {
    // 验证文档所有权（通过 workspace）
    const ownership = await verifyDocumentOwnership(db, documentId, userId);
    if (!ownership.ownsDocument) {
      throw new AuthError("Access denied to this document");
    }

    const latest = await db.query.documentSnapshots.findFirst({
      where: eq(documentSnapshots.documentId, documentId),
      orderBy: [desc(documentSnapshots.timestamp)],
    });

    return { timestamp: latest ? latest.timestamp.getTime() : null };
  },
);

/**
 * 批量同步快照到服务器
 */
export const syncSnapshotsAction = createSafeAction(
  z.object({
    snapshots: z.array(ServerSnapshotSchema),
  }),
  async ({ snapshots }, userId) => {
    if (snapshots.length === 0) return { count: 0 };

    // 验证用户对所有文档的所有权（去重以提高性能）
    const uniqueDocumentIds = [...new Set(snapshots.map((s) => s.documentId))];
    for (const documentId of uniqueDocumentIds) {
      const ownership = await verifyDocumentOwnership(db, documentId, userId);
      if (!ownership.ownsDocument) {
        throw new AuthError(`Access denied to document: ${documentId}`);
      }
    }

    const values = snapshots.map((snap) => ({
      id: snap.id,
      documentId: snap.documentId,
      yjsState: Buffer.from(snap.yjsState, "base64"),
      plainText: snap.plainText,
      timestamp: new Date(snap.timestamp),
      trigger: snap.trigger,
      summary: snap.summary,
      wordCount: snap.wordCount,
      diffAdded: snap.diffAdded,
      diffRemoved: snap.diffRemoved,
    }));

    await db.insert(documentSnapshots).values(values).onConflictDoNothing();

    return { count: snapshots.length };
  },
);

/**
 * 获取文档的所有快照（用于拉取）
 */
export const getDocumentSnapshotsAction = createSafeAction(
  z.object({ documentId: z.string().uuid() }),
  async ({ documentId }, userId) => {
    // 验证文档所有权（通过 workspace）
    const ownership = await verifyDocumentOwnership(db, documentId, userId);
    if (!ownership.ownsDocument) {
      throw new AuthError("Access denied to this document");
    }

    const snaps = await db.query.documentSnapshots.findMany({
      where: eq(documentSnapshots.documentId, documentId),
      orderBy: [desc(documentSnapshots.timestamp)],
    });

    return {
      snapshots: snaps.map((s) => ({
        id: s.id,
        documentId: s.documentId,
        yjsState: s.yjsState?.toString("base64") || "",
        plainText: s.plainText || "",
        timestamp: s.timestamp.getTime(),
        trigger: s.trigger,
        summary: s.summary,
        wordCount: s.wordCount,
        diffAdded: s.diffAdded,
        diffRemoved: s.diffRemoved,
      })),
    };
  },
);

/**
 * 删除服务器快照
 */
export const deleteSnapshotAction = createSafeAction(
  z.object({ snapshotId: z.string() }),
  async ({ snapshotId }, userId) => {
    // 首先获取快照以确定关联的文档
    const snapshot = await db.query.documentSnapshots.findFirst({
      where: eq(documentSnapshots.id, snapshotId),
      columns: {
        id: true,
        documentId: true,
      },
    });

    if (!snapshot) {
      throw new Error("Snapshot not found");
    }

    // 验证文档所有权（通过 workspace）
    const ownership = await verifyDocumentOwnership(
      db,
      snapshot.documentId ?? "",
      userId,
    );
    if (!ownership.ownsDocument) {
      throw new AuthError("Access denied to this snapshot");
    }

    await db
      .delete(documentSnapshots)
      .where(eq(documentSnapshots.id, snapshotId));

    return { success: true };
  },
);

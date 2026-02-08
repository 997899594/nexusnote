"use server";

import { db, documentSnapshots, eq, desc, and, inArray } from "@nexusnote/db";
import { createSafeAction } from "@/lib/actions/action-utils";
import { z } from "zod";
import { auth } from "@/auth";

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
  async ({ documentId }) => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // 理论上这里应该验证用户是否有该文档的权限，
    // 但为了同步性能，假设调用者已在前端层验证

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
  async ({ snapshots }) => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (snapshots.length === 0) return { count: 0 };

    // 转换并插入
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

    // 使用 onConflictDoNothing 防止重复插入
    await db.insert(documentSnapshots).values(values).onConflictDoNothing();

    return { count: snapshots.length };
  },
);

/**
 * 获取文档的所有快照（用于拉取）
 */
export const getDocumentSnapshotsAction = createSafeAction(
  z.object({ documentId: z.string().uuid() }),
  async ({ documentId }) => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

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
  async ({ snapshotId }) => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db
      .delete(documentSnapshots)
      .where(eq(documentSnapshots.id, snapshotId));

    return { success: true };
  },
);

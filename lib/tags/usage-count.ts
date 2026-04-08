import { eq, sql } from "drizzle-orm";
import type { db } from "@/db";
import { tags } from "@/db/schema";

export type NoteTagStatus = "pending" | "confirmed" | "rejected";

type TagUsageExecutor = Pick<typeof db, "update">;

export function getTagUsageDelta(
  previousStatus: NoteTagStatus,
  nextStatus: NoteTagStatus,
): -1 | 0 | 1 {
  if (previousStatus === "rejected" && nextStatus !== "rejected") {
    return 1;
  }

  if (previousStatus !== "rejected" && nextStatus === "rejected") {
    return -1;
  }

  return 0;
}

export async function applyTagUsageDelta(
  executor: TagUsageExecutor,
  tagId: string,
  delta: -1 | 0 | 1,
): Promise<void> {
  if (delta === 0) {
    return;
  }

  await executor
    .update(tags)
    .set({
      usageCount:
        delta > 0 ? sql`${tags.usageCount} + 1` : sql`GREATEST(${tags.usageCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(tags.id, tagId));
}

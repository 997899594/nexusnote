import { and, count, eq, ne } from "drizzle-orm";
import type { db } from "@/db";
import { noteTags, tags } from "@/db/schema";

export type NoteTagStatus = "pending" | "confirmed" | "rejected";

type TagUsageExecutor = Pick<typeof db, "select" | "update">;

export async function syncTagUsageCount(
  executor: TagUsageExecutor,
  tagId: string,
): Promise<number> {
  const [result] = await executor
    .select({
      count: count(),
    })
    .from(noteTags)
    .where(and(eq(noteTags.tagId, tagId), ne(noteTags.status, "rejected")));

  const nextUsageCount = Number(result?.count ?? 0);

  await executor
    .update(tags)
    .set({
      usageCount: nextUsageCount,
      updatedAt: new Date(),
    })
    .where(eq(tags.id, tagId));

  return nextUsageCount;
}

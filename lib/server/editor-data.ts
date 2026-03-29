import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, notes } from "@/db";
import { getNoteDetailTag, getNotesIndexTag } from "@/lib/cache/tags";

export async function getRecentNotesCached(userId: string, limit = 24) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));

  return db.query.notes.findMany({
    where: eq(notes.userId, userId),
    orderBy: desc(notes.updatedAt),
    limit,
  });
}

export async function getNoteDetailCached(userId: string, noteId: string) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));
  cacheTag(getNoteDetailTag(userId, noteId));

  return db.query.notes.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, noteId), eq(table.userId, userId)),
  });
}

import { desc, inArray } from "drizzle-orm";
import { db, eq, notes } from "@/db";

export type NoteRecord = typeof notes.$inferSelect;

export async function getOwnedNote(noteId: string, userId: string): Promise<NoteRecord | null> {
  return (
    (await db.query.notes.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, noteId), eq(table.userId, userId)),
    })) ?? null
  );
}

export async function listOwnedRecentNotes(userId: string, limit: number): Promise<NoteRecord[]> {
  return db.query.notes.findMany({
    where: eq(notes.userId, userId),
    orderBy: desc(notes.updatedAt),
    limit,
  });
}

export async function listOwnedNotesByIds(
  userId: string,
  noteIds: string[],
): Promise<NoteRecord[]> {
  if (noteIds.length === 0) {
    return [];
  }

  return db.query.notes.findMany({
    where: (table, { and, eq: tableEq }) =>
      and(tableEq(table.userId, userId), inArray(table.id, noteIds)),
  });
}

import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, notes } from "@/db";
import { getNoteDetailTag, getNotesIndexTag } from "@/lib/cache/tags";

export type NoteWorkbenchKind = "all" | "highlight" | "note" | "capture" | "manual";

export interface NoteWorkbenchItem {
  id: string;
  title: string;
  plainText: string | null;
  updatedAt: Date | null;
  sourceType: string;
  sourceContext: typeof notes.$inferSelect.sourceContext | null;
  kind: Exclude<NoteWorkbenchKind, "all">;
}

export interface NotesWorkbenchSnapshot {
  items: NoteWorkbenchItem[];
  counts: Record<NoteWorkbenchKind, number>;
  courses: Array<{
    courseId: string;
    courseTitle: string;
    noteCount: number;
    latestUpdatedAt: Date | null;
  }>;
}

function classifyNoteKind(note: {
  sourceType: string;
  sourceContext: typeof notes.$inferSelect.sourceContext | null;
}): Exclude<NoteWorkbenchKind, "all"> {
  if (note.sourceType === "course_capture") {
    if (note.sourceContext?.chatCapture || note.sourceContext?.source === "learn_chat_capture") {
      return "capture";
    }
    if (note.sourceContext?.noteContent?.trim()) {
      return "note";
    }
    return "highlight";
  }

  return "manual";
}

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

export async function getNotesWorkbenchCached(userId: string): Promise<NotesWorkbenchSnapshot> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));

  const rows = await db.query.notes.findMany({
    where: eq(notes.userId, userId),
    orderBy: desc(notes.updatedAt),
    limit: 200,
  });

  const items: NoteWorkbenchItem[] = rows.map((note) => ({
    id: note.id,
    title: note.title,
    plainText: note.plainText,
    updatedAt: note.updatedAt,
    sourceType: note.sourceType,
    sourceContext: note.sourceContext ?? null,
    kind: classifyNoteKind(note),
  }));

  const counts: Record<NoteWorkbenchKind, number> = {
    all: items.length,
    highlight: 0,
    note: 0,
    capture: 0,
    manual: 0,
  };

  for (const item of items) {
    counts[item.kind] += 1;
  }

  const courseMap = new Map<
    string,
    {
      courseId: string;
      courseTitle: string;
      noteCount: number;
      latestUpdatedAt: Date | null;
    }
  >();

  for (const item of items) {
    const courseId = item.sourceContext?.courseId;
    const courseTitle = item.sourceContext?.courseTitle?.trim();

    if (!courseId || !courseTitle) {
      continue;
    }

    const existing = courseMap.get(courseId);
    if (!existing) {
      courseMap.set(courseId, {
        courseId,
        courseTitle,
        noteCount: 1,
        latestUpdatedAt: item.updatedAt,
      });
      continue;
    }

    existing.noteCount += 1;
    if (
      item.updatedAt &&
      (!existing.latestUpdatedAt || item.updatedAt.getTime() > existing.latestUpdatedAt.getTime())
    ) {
      existing.latestUpdatedAt = item.updatedAt;
    }
  }

  const courses = Array.from(courseMap.values()).sort((a, b) => {
    const left = a.latestUpdatedAt?.getTime() ?? 0;
    const right = b.latestUpdatedAt?.getTime() ?? 0;
    return right - left;
  });

  return {
    items,
    counts,
    courses,
  };
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

import { and, db, eq, knowledgeChunks, notes } from "@/db";
import type { NoteSourceContext } from "@/db/schema/notes";
import {
  revalidateNoteDetail,
  revalidateNotesIndex,
  revalidateProfileStats,
} from "@/lib/cache/tags";
import { htmlToPlainText, plainTextToHtml } from "@/lib/notes/content";
import { indexNote } from "@/lib/rag/chunker";

type NoteRecord = typeof notes.$inferSelect;

export type NoteContentInput =
  | { kind: "html"; contentHtml: string }
  | { kind: "plainText"; plainText: string }
  | { kind: "both"; contentHtml: string; plainText: string };

interface CreateOwnedNoteParams {
  userId: string;
  title: string;
  content: NoteContentInput;
  sourceType?: string;
  sourceContext?: NoteSourceContext | null;
}

interface UpdateOwnedNoteParams {
  noteId: string;
  userId: string;
  title?: string;
  content?: NoteContentInput;
}

function normalizeStoredValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveNoteContent(content: NoteContentInput): {
  contentHtml: string | null;
  plainText: string | null;
} {
  switch (content.kind) {
    case "html": {
      const contentHtml = normalizeStoredValue(content.contentHtml);
      const plainText = normalizeStoredValue(htmlToPlainText(content.contentHtml));
      return {
        contentHtml,
        plainText,
      };
    }
    case "plainText": {
      const plainText = normalizeStoredValue(content.plainText);
      const contentHtml = normalizeStoredValue(plainTextToHtml(content.plainText));
      return {
        contentHtml,
        plainText,
      };
    }
    case "both":
      return {
        contentHtml: normalizeStoredValue(content.contentHtml),
        plainText: normalizeStoredValue(content.plainText),
      };
  }
}

function buildNoteIndexMetadata(note: Pick<NoteRecord, "sourceType" | "sourceContext">) {
  return {
    sourceType: note.sourceType,
    sourceContext: note.sourceContext ?? null,
    ...(note.sourceContext?.courseId && { courseId: note.sourceContext.courseId }),
    ...(note.sourceContext?.sectionId && { sectionId: note.sourceContext.sectionId }),
    ...(note.sourceContext?.source && { source: note.sourceContext.source }),
  };
}

function revalidateNoteCaches(userId: string, noteId: string) {
  revalidateNotesIndex(userId);
  revalidateNoteDetail(userId, noteId);
  revalidateProfileStats(userId);
}

async function syncNoteIndex(note: NoteRecord, userId: string): Promise<void> {
  try {
    await indexNote(note.id, note.plainText ?? "", {
      userId,
      metadata: buildNoteIndexMetadata(note),
    });
  } catch (error) {
    console.error("[NoteWriteService] Failed to index note:", error);
  }
}

function appendPlainTextAsParagraph(existingHtml: string, plainText: string): string {
  const addition = plainTextToHtml(plainText);
  if (!addition) {
    return existingHtml;
  }

  return `${existingHtml}${addition}`;
}

export async function getOwnedNote(noteId: string, userId: string): Promise<NoteRecord | null> {
  return (
    (await db.query.notes.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, noteId), eq(table.userId, userId)),
    })) ?? null
  );
}

export async function createOwnedNote(params: CreateOwnedNoteParams): Promise<NoteRecord> {
  const { userId, title, content, sourceType, sourceContext } = params;
  const resolvedContent = resolveNoteContent(content);

  const [note] = await db
    .insert(notes)
    .values({
      userId,
      title,
      ...(sourceType !== undefined && { sourceType }),
      ...(sourceContext !== undefined && { sourceContext }),
      contentHtml: resolvedContent.contentHtml,
      plainText: resolvedContent.plainText,
    })
    .returning();

  await syncNoteIndex(note, userId);
  revalidateNoteCaches(userId, note.id);

  return note;
}

export async function updateOwnedNote(params: UpdateOwnedNoteParams): Promise<NoteRecord | null> {
  const { noteId, userId, title, content } = params;
  const existing = await getOwnedNote(noteId, userId);

  if (!existing) {
    return null;
  }

  const resolvedContent = content
    ? resolveNoteContent(content)
    : {
        contentHtml: existing.contentHtml ?? null,
        plainText: existing.plainText ?? null,
      };

  const [note] = await db
    .update(notes)
    .set({
      ...(title !== undefined && { title }),
      ...(content !== undefined && {
        contentHtml: resolvedContent.contentHtml,
        plainText: resolvedContent.plainText,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .returning();

  if (!note) {
    return null;
  }

  await syncNoteIndex(note, userId);
  revalidateNoteCaches(userId, note.id);

  return note;
}

export async function appendOwnedNoteText(params: {
  noteId: string;
  userId: string;
  plainText: string;
}): Promise<NoteRecord | null> {
  const { noteId, userId, plainText } = params;
  const existing = await getOwnedNote(noteId, userId);

  if (!existing) {
    return null;
  }

  if (!plainText.trim()) {
    return existing;
  }

  const existingHtml = existing.contentHtml ?? plainTextToHtml(existing.plainText ?? "");
  return updateOwnedNote({
    noteId,
    userId,
    content: {
      kind: "html",
      contentHtml: appendPlainTextAsParagraph(existingHtml, plainText),
    },
  });
}

export async function deleteOwnedNote(noteId: string, userId: string): Promise<NoteRecord | null> {
  const [deleted] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);

    if (!existing) {
      return [];
    }

    await tx
      .delete(knowledgeChunks)
      .where(and(eq(knowledgeChunks.sourceType, "note"), eq(knowledgeChunks.sourceId, noteId)));

    const [note] = await tx
      .delete(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning();

    return note ? [note] : [];
  });

  if (!deleted) {
    return null;
  }

  revalidateNoteCaches(userId, noteId);
  return deleted;
}

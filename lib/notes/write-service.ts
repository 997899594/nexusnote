import { and, db, eq, notes } from "@/db";
import type { NoteSourceContext } from "@/db/schema/notes";
import {
  revalidateNoteDetail,
  revalidateNotesIndex,
  revalidateProfileStats,
} from "@/lib/cache/tags";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { syncKnowledgeSource } from "@/lib/knowledge/source-sync";
import { resolveNoteBackedKnowledgeSourceType } from "@/lib/knowledge/source-types";
import { buildChapterOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { htmlToPlainText, plainTextToHtml } from "@/lib/notes/content";
import { syncSourceKnowledgeEvidenceChunks } from "@/lib/rag/chunker";

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

interface TrackedNoteRef {
  refType: string;
  refId: string;
  snippet?: string | null;
  weight: number;
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

function appendPlainTextAsParagraph(existingHtml: string, plainText: string): string {
  const addition = plainTextToHtml(plainText);
  if (!addition) {
    return existingHtml;
  }

  return `${existingHtml}${addition}`;
}

function buildTrackedNoteRefs(note: Pick<NoteRecord, "id" | "plainText" | "sourceContext">) {
  const refs: TrackedNoteRef[] = [];

  const sourceContext = note.sourceContext ?? null;
  const primarySnippet =
    sourceContext?.selectionText ??
    sourceContext?.latestExcerpt ??
    note.plainText?.slice(0, 240) ??
    null;
  const chapterKey =
    typeof sourceContext?.chapterIndex === "number"
      ? buildChapterOutlineNodeKey(sourceContext.chapterIndex)
      : null;
  const chapterSnippet = sourceContext?.chatCapture ? (sourceContext.sectionTitle ?? null) : null;

  if (sourceContext?.courseId) {
    refs.push({
      refType: "course",
      refId: sourceContext.courseId,
      snippet: sourceContext.courseTitle ?? null,
      weight: 1,
    });
  }

  if (chapterKey) {
    refs.push({
      refType: "chapter",
      refId: chapterKey,
      snippet: chapterSnippet,
      weight: 1,
    });
  }

  if (sourceContext?.sectionId) {
    refs.push({
      refType: "course_section",
      refId: sourceContext.sectionId,
      snippet: primarySnippet,
      weight: 1,
    });
  }

  if (sourceContext?.chatCapture && sourceContext.courseId) {
    refs.push({
      refType: "conversation_capture",
      refId: `${sourceContext.courseId}:${sourceContext.chapterIndex ?? "unknown"}`,
      snippet: sourceContext.latestExcerpt ?? primarySnippet,
      weight: 1,
    });
  }

  if (refs.length === 0) {
    refs.push({
      refType: "note",
      refId: note.id,
      snippet: primarySnippet,
      weight: 1,
    });
  }

  return refs;
}

async function syncTrackedNoteKnowledge(note: NoteRecord): Promise<void> {
  const knowledgeSourceType = resolveNoteBackedKnowledgeSourceType(note.sourceType);
  const metadata = {
    sourceType: note.sourceType,
    sourceContext: note.sourceContext ?? null,
  };

  await syncKnowledgeSource({
    userId: note.userId,
    sourceType: knowledgeSourceType,
    sourceId: note.id,
    hasContent: true,
    clearReason: `note-clear:${note.id}`,
    replaceEvents: async () => {
      await ingestEvidenceEvent({
        id: crypto.randomUUID(),
        userId: note.userId,
        kind: knowledgeSourceType === "capture" ? "capture" : "note",
        sourceType: knowledgeSourceType,
        sourceId: note.id,
        sourceVersionHash: null,
        title: note.title,
        summary: note.plainText ?? note.title,
        confidence: 1,
        happenedAt: new Date().toISOString(),
        metadata,
        refs: buildTrackedNoteRefs(note),
      });
    },
    syncChunks: async () => {
      await syncSourceKnowledgeEvidenceChunks({
        userId: note.userId,
        sourceType: knowledgeSourceType,
        sourceId: note.id,
        sourceVersionHash: null,
        metadata: buildNoteIndexMetadata(note),
      });
    },
  });
}

async function clearTrackedNoteKnowledge(
  noteId: string,
  userId: string,
  noteSourceType: string,
): Promise<void> {
  const knowledgeSourceType = resolveNoteBackedKnowledgeSourceType(noteSourceType);
  await syncKnowledgeSource({
    userId,
    sourceType: knowledgeSourceType,
    sourceId: noteId,
    hasContent: false,
    clearReason: `note-clear:${noteId}`,
    enqueueInsightsOnEmpty: false,
  });
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

  await syncTrackedNoteKnowledge(note);
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

  await syncTrackedNoteKnowledge(note);
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

    const [note] = await tx
      .delete(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .returning();

    return note ? [note] : [];
  });

  if (!deleted) {
    return null;
  }

  await clearTrackedNoteKnowledge(noteId, userId, deleted.sourceType);
  revalidateNoteCaches(userId, noteId);
  return deleted;
}

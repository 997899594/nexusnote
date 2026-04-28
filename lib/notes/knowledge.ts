import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { syncKnowledgeSource } from "@/lib/knowledge/source-sync";
import { resolveNoteBackedKnowledgeSourceType } from "@/lib/knowledge/source-types";
import { buildChapterOutlineNodeKey } from "@/lib/learning/outline-node-key";
import type { NoteRecord } from "@/lib/notes/repository";
import { syncSourceKnowledgeEvidenceChunks } from "@/lib/rag/chunker";

interface TrackedNoteRef {
  refType: string;
  refId: string;
  snippet?: string | null;
  weight: number;
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

export async function syncNoteKnowledge(
  note: NoteRecord,
  options?: { enqueueFollowups?: boolean },
): Promise<string[]> {
  const knowledgeSourceType = resolveNoteBackedKnowledgeSourceType(note.sourceType);
  const metadata = {
    sourceType: note.sourceType,
    sourceContext: note.sourceContext ?? null,
  };

  const result = await syncKnowledgeSource({
    userId: note.userId,
    sourceType: knowledgeSourceType,
    sourceId: note.id,
    hasContent: Boolean(note.plainText?.trim() || note.contentHtml?.trim()),
    clearReason: `note-clear:${note.id}`,
    enqueueFollowups: options?.enqueueFollowups,
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
      return syncSourceKnowledgeEvidenceChunks({
        userId: note.userId,
        sourceType: knowledgeSourceType,
        sourceId: note.id,
        sourceVersionHash: null,
        metadata: buildNoteIndexMetadata(note),
      });
    },
  });

  return result.affectedNodeIds;
}

export async function clearNoteKnowledge(
  noteId: string,
  userId: string,
  noteSourceType: string,
  options?: { enqueueFollowups?: boolean },
): Promise<string[]> {
  const knowledgeSourceType = resolveNoteBackedKnowledgeSourceType(noteSourceType);
  const result = await syncKnowledgeSource({
    userId,
    sourceType: knowledgeSourceType,
    sourceId: noteId,
    hasContent: false,
    clearReason: `note-clear:${noteId}`,
    enqueueInsightsOnEmpty: false,
    enqueueFollowups: options?.enqueueFollowups,
  });

  return result.affectedNodeIds;
}

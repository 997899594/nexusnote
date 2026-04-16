export const NOTE_KNOWLEDGE_SOURCE_TYPE = "note";
export const CAPTURE_KNOWLEDGE_SOURCE_TYPE = "capture";

export const NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES = [
  NOTE_KNOWLEDGE_SOURCE_TYPE,
  CAPTURE_KNOWLEDGE_SOURCE_TYPE,
] as const;

export type NoteBackedKnowledgeSourceType = (typeof NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES)[number];

export function resolveNoteBackedKnowledgeSourceType(
  noteSourceType: string | null | undefined,
): NoteBackedKnowledgeSourceType {
  return noteSourceType === "course_capture"
    ? CAPTURE_KNOWLEDGE_SOURCE_TYPE
    : NOTE_KNOWLEDGE_SOURCE_TYPE;
}

export function isNoteBackedKnowledgeSourceType(
  sourceType: string,
): sourceType is NoteBackedKnowledgeSourceType {
  return (NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES as readonly string[]).includes(sourceType);
}

export function expandNoteBackedKnowledgeSourceTypes(
  sourceTypes: string[] | undefined,
): string[] | undefined {
  if (!sourceTypes || sourceTypes.length === 0) {
    return undefined;
  }

  return [
    ...new Set(
      sourceTypes.flatMap((sourceType) =>
        sourceType === NOTE_KNOWLEDGE_SOURCE_TYPE
          ? [...NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES]
          : [sourceType],
      ),
    ),
  ];
}

import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { syncKnowledgeSource } from "@/lib/knowledge/source-sync";

export interface AnnotationKnowledgeRecord {
  id: string;
  type: "highlight" | "note";
  anchor: {
    textContent: string;
    startOffset: number;
    endOffset: number;
  };
  color?: string | null;
  noteContent?: string | null;
  createdAt: string | Date;
}

function buildAnnotationEvidenceRefs(params: {
  annotationId: string;
  sectionId: string;
  sectionText: string;
  courseId: string;
  courseTitle: string;
  chapterKey: string | null;
}) {
  const refs: Array<{
    refType: string;
    refId: string;
    snippet: string | null;
    weight: number;
  }> = [
    {
      refType: "annotation",
      refId: params.annotationId,
      snippet: params.sectionText,
      weight: 1,
    },
    {
      refType: "course_section",
      refId: params.sectionId,
      snippet: params.sectionText,
      weight: 1,
    },
    {
      refType: "course",
      refId: params.courseId,
      snippet: params.courseTitle,
      weight: 1,
    },
  ];

  if (params.chapterKey) {
    refs.push({
      refType: "chapter",
      refId: params.chapterKey,
      snippet: null,
      weight: 1,
    });
  }

  return refs;
}

function buildAnnotationEventTitle(type: AnnotationKnowledgeRecord["type"]): string {
  return type === "note" ? "课程标注笔记" : "课程高亮";
}

export async function syncSectionAnnotationsKnowledge(params: {
  userId: string;
  sectionId: string;
  courseId: string;
  courseTitle: string;
  chapterKey: string | null;
  annotations: AnnotationKnowledgeRecord[];
  enqueueFollowups?: boolean;
}): Promise<string[]> {
  return syncKnowledgeSource({
    userId: params.userId,
    sourceType: "annotation",
    sourceId: params.sectionId,
    hasContent: params.annotations.length > 0,
    clearReason: `annotation-clear:${params.sectionId}`,
    enqueueFollowups: params.enqueueFollowups,
    replaceEvents: async () => {
      for (const annotation of params.annotations) {
        await ingestEvidenceEvent({
          id: crypto.randomUUID(),
          userId: params.userId,
          kind: annotation.type === "note" ? "note" : "highlight",
          sourceType: "annotation",
          sourceId: params.sectionId,
          sourceVersionHash: null,
          title: buildAnnotationEventTitle(annotation.type),
          summary: annotation.noteContent?.trim() || annotation.anchor.textContent,
          confidence: 1,
          happenedAt:
            annotation.createdAt instanceof Date
              ? annotation.createdAt.toISOString()
              : new Date(annotation.createdAt).toISOString(),
          metadata: {
            annotationId: annotation.id,
            sectionId: params.sectionId,
            annotationType: annotation.type,
            color: annotation.color ?? null,
          },
          refs: buildAnnotationEvidenceRefs({
            annotationId: annotation.id,
            sectionId: params.sectionId,
            sectionText: annotation.anchor.textContent,
            courseId: params.courseId,
            courseTitle: params.courseTitle,
            chapterKey: params.chapterKey,
          }),
        });
      }
    },
  });
}

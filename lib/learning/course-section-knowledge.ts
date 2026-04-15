import { enqueueKnowledgeInsights } from "@/lib/growth/queue";
import { deleteEvidenceEventsBySource, ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateSourceEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence";
import { syncSourceKnowledgeEvidenceChunks } from "@/lib/rag/chunker";

interface SyncCourseSectionKnowledgeParams {
  documentId: string;
  plainText: string;
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  sectionTitle: string;
}

export async function syncCourseSectionKnowledge(
  params: SyncCourseSectionKnowledgeParams,
): Promise<void> {
  await deleteEvidenceEventsBySource({
    userId: params.userId,
    sourceType: "course_section",
    sourceId: params.documentId,
    sourceVersionHash: null,
  });

  await ingestEvidenceEvent({
    id: crypto.randomUUID(),
    userId: params.userId,
    kind: "course_section",
    sourceType: "course_section",
    sourceId: params.documentId,
    sourceVersionHash: null,
    title: params.sectionTitle,
    summary: params.plainText,
    confidence: 1,
    happenedAt: new Date().toISOString(),
    metadata: {
      courseId: params.courseId,
      chapterIndex: params.chapterIndex,
      sectionIndex: params.sectionIndex,
      sectionTitle: params.sectionTitle,
    },
    refs: [
      {
        refType: "course",
        refId: params.courseId,
        snippet: params.sectionTitle,
        weight: 1,
      },
      {
        refType: "chapter",
        refId: `chapter-${params.chapterIndex + 1}`,
        snippet: params.sectionTitle,
        weight: 1,
      },
      {
        refType: "section",
        refId: `section-${params.chapterIndex + 1}-${params.sectionIndex + 1}`,
        snippet: params.sectionTitle,
        weight: 1,
      },
    ],
  });

  await aggregateSourceEventsToKnowledgeEvidence({
    userId: params.userId,
    sourceType: "course_section",
    sourceId: params.documentId,
    sourceVersionHash: null,
  });

  await syncSourceKnowledgeEvidenceChunks({
    userId: params.userId,
    sourceType: "course_section",
    sourceId: params.documentId,
    sourceVersionHash: null,
    metadata: {
      courseId: params.courseId,
      chapterIndex: params.chapterIndex,
      sectionIndex: params.sectionIndex,
      sectionTitle: params.sectionTitle,
    },
  });

  await enqueueKnowledgeInsights(params.userId);
}

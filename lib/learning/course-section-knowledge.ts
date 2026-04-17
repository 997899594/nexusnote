import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { syncKnowledgeSource } from "@/lib/knowledge/source-sync";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
} from "@/lib/learning/outline-node-key";
import { syncSourceKnowledgeEvidenceChunks } from "@/lib/rag/chunker";

interface SyncCourseSectionKnowledgeParams {
  documentId: string;
  plainText: string;
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  sectionTitle: string;
  enqueueFollowups?: boolean;
}

export async function syncCourseSectionKnowledge(
  params: SyncCourseSectionKnowledgeParams,
): Promise<string[]> {
  const metadata = {
    courseId: params.courseId,
    chapterIndex: params.chapterIndex,
    sectionIndex: params.sectionIndex,
    sectionTitle: params.sectionTitle,
  };

  return syncKnowledgeSource({
    userId: params.userId,
    sourceType: "course_section",
    sourceId: params.documentId,
    hasContent: params.plainText.trim().length > 0,
    clearReason: `course-section-clear:${params.documentId}`,
    enqueueFollowups: params.enqueueFollowups,
    replaceEvents: async () => {
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
        metadata,
        refs: [
          {
            refType: "course",
            refId: params.courseId,
            snippet: params.sectionTitle,
            weight: 1,
          },
          {
            refType: "chapter",
            refId: buildChapterOutlineNodeKey(params.chapterIndex),
            snippet: params.sectionTitle,
            weight: 1,
          },
          {
            refType: "section",
            refId: buildSectionOutlineNodeKey(params.chapterIndex, params.sectionIndex),
            snippet: params.sectionTitle,
            weight: 1,
          },
        ],
      });
    },
    syncChunks: async () => {
      await syncSourceKnowledgeEvidenceChunks({
        userId: params.userId,
        sourceType: "course_section",
        sourceId: params.documentId,
        sourceVersionHash: null,
        metadata,
      });
    },
  });
}

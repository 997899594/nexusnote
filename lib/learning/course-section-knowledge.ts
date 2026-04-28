import { and, courseSections, courses, db, eq } from "@/db";
import { buildKnowledgeContentHash } from "@/lib/knowledge/content-hash";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { type SyncKnowledgeSourceResult, syncKnowledgeSource } from "@/lib/knowledge/source-sync";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
  parseSectionOutlineNodeKey,
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

export interface SyncCourseSectionKnowledgeResult extends SyncKnowledgeSourceResult {
  documentId: string;
  indexedContentHash: string | null;
}

export async function syncCourseSectionKnowledge(
  params: SyncCourseSectionKnowledgeParams,
): Promise<SyncCourseSectionKnowledgeResult> {
  const plainText = params.plainText.trim();
  const metadata = {
    courseId: params.courseId,
    chapterIndex: params.chapterIndex,
    sectionIndex: params.sectionIndex,
    sectionTitle: params.sectionTitle,
  };

  const result = await syncKnowledgeSource({
    userId: params.userId,
    sourceType: "course_section",
    sourceId: params.documentId,
    hasContent: plainText.length > 0,
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
        summary: plainText,
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
      return syncSourceKnowledgeEvidenceChunks({
        userId: params.userId,
        sourceType: "course_section",
        sourceId: params.documentId,
        sourceVersionHash: null,
        metadata,
      });
    },
  });

  return {
    ...result,
    documentId: params.documentId,
    indexedContentHash: plainText ? buildKnowledgeContentHash(plainText) : null,
  };
}

export async function syncCourseSectionKnowledgeByDocumentId(params: {
  documentId: string;
  userId: string;
  courseId: string;
}): Promise<SyncCourseSectionKnowledgeResult> {
  const [section] = await db
    .select({
      id: courseSections.id,
      courseId: courseSections.courseId,
      outlineNodeKey: courseSections.outlineNodeKey,
      title: courseSections.title,
      contentMarkdown: courseSections.contentMarkdown,
      plainText: courseSections.plainText,
    })
    .from(courseSections)
    .innerJoin(courses, eq(courseSections.courseId, courses.id))
    .where(
      and(
        eq(courseSections.id, params.documentId),
        eq(courseSections.courseId, params.courseId),
        eq(courses.userId, params.userId),
      ),
    )
    .limit(1);

  if (!section) {
    throw new Error(`Course section is missing or not owned: ${params.documentId}`);
  }

  const outlinePosition = parseSectionOutlineNodeKey(section.outlineNodeKey);
  if (!outlinePosition) {
    throw new Error(`Invalid course section outline node key: ${section.outlineNodeKey}`);
  }

  return syncCourseSectionKnowledge({
    documentId: section.id,
    plainText: section.plainText ?? section.contentMarkdown ?? "",
    userId: params.userId,
    courseId: section.courseId,
    chapterIndex: outlinePosition.chapterIndex,
    sectionIndex: outlinePosition.sectionIndex,
    sectionTitle: section.title,
  });
}

import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  courseProgress,
  courseSectionAnnotations,
  courseSections,
  db,
  knowledgeInsights,
} from "@/db";
import type { Annotation } from "@/hooks/useAnnotations";
import { getCareerTreesTag, getLearnPageTag, getProfileStatsTag } from "@/lib/cache/tags";
import { getLatestFocusSnapshot } from "@/lib/growth/projection-data";
import type { GrowthFocusSummary, GrowthInsightSummary } from "@/lib/growth/projection-types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { createLearnTrace } from "@/lib/learning/observability";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";

export interface LearnSectionData {
  title: string;
  description: string;
}

export interface LearnChapterData {
  title: string;
  description: string;
  sections: LearnSectionData[];
}

export interface LearnPageSnapshot {
  courseTitle: string;
  chapters: Array<{
    title: string;
    description: string;
    sections: Array<{
      title: string;
      description: string;
      nodeId: string;
    }>;
  }>;
  sectionDocs: Array<{
    id: string;
    title: string | null;
    content: string | null;
    outlineNodeKey: string | null;
    annotations: Annotation[];
  }>;
  progressRecord: {
    currentChapter: number;
    completedSections: string[];
    completedAt: Date | null;
  } | null;
  growthFocus: GrowthFocusSummary | null;
  insights: GrowthInsightSummary[];
}

export async function getLearnPageSnapshotCached(
  userId: string,
  courseId: string,
): Promise<LearnPageSnapshot | null> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getLearnPageTag(userId, courseId));
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));

  const trace = createLearnTrace("page-snapshot", {
    userId,
    courseId,
  });

  const courseSession = await getOwnedCourseWithOutline(courseId, userId);
  if (!courseSession) {
    trace.finish({
      found: false,
    });
    return null;
  }

  const chapters = courseSession.outline.chapters.map((ch, chIdx) => ({
    title: ch.title,
    description: ch.description ?? "",
    sections: ch.sections.map((sec, secIdx) => ({
      title: sec.title,
      description: sec.description ?? "",
      nodeId: buildSectionOutlineNodeKey(chIdx, secIdx),
    })),
  }));
  trace.step("course-loaded", {
    chapterCount: chapters.length,
  });

  const [progressRecord, focusSnapshot, insightRows] = await Promise.all([
    db
      .select({
        currentChapter: courseProgress.currentChapter,
        completedSections: courseProgress.completedSections,
        completedAt: courseProgress.completedAt,
      })
      .from(courseProgress)
      .where(and(eq(courseProgress.courseId, courseId), eq(courseProgress.userId, userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getLatestFocusSnapshot(userId),
    db
      .select({
        id: knowledgeInsights.id,
        kind: knowledgeInsights.kind,
        title: knowledgeInsights.title,
        summary: knowledgeInsights.summary,
        confidence: knowledgeInsights.confidence,
      })
      .from(knowledgeInsights)
      .where(eq(knowledgeInsights.userId, userId))
      .orderBy(desc(knowledgeInsights.confidence), desc(knowledgeInsights.updatedAt))
      .limit(3),
  ]);

  const rawSections = await db
    .select({
      id: courseSections.id,
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeKey: courseSections.outlineNodeKey,
    })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId));

  const annotations = await db
    .select({
      id: courseSectionAnnotations.id,
      courseSectionId: courseSectionAnnotations.courseSectionId,
      type: courseSectionAnnotations.type,
      anchor: courseSectionAnnotations.anchor,
      color: courseSectionAnnotations.color,
      noteContent: courseSectionAnnotations.noteContent,
      createdAt: courseSectionAnnotations.createdAt,
    })
    .from(courseSectionAnnotations)
    .innerJoin(courseSections, eq(courseSectionAnnotations.courseSectionId, courseSections.id))
    .where(and(eq(courseSectionAnnotations.userId, userId), eq(courseSections.courseId, courseId)));
  trace.step("records-loaded", {
    hasProgress: Boolean(progressRecord),
    sectionDocCount: rawSections.length,
    annotationCount: annotations.length,
  });

  const annotationsBySectionId = new Map<string, Annotation[]>();

  for (const annotation of annotations) {
    const existing = annotationsBySectionId.get(annotation.courseSectionId) ?? [];
    existing.push({
      id: annotation.id,
      type: annotation.type as "highlight" | "note",
      anchor: annotation.anchor as {
        textContent: string;
        startOffset: number;
        endOffset: number;
      },
      color: annotation.color ?? undefined,
      noteContent: annotation.noteContent ?? undefined,
      createdAt: annotation.createdAt?.toISOString() ?? "",
    });
    annotationsBySectionId.set(annotation.courseSectionId, existing);
  }

  const sectionDocs = rawSections.map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    outlineNodeKey: doc.outlineNodeKey,
    annotations: annotationsBySectionId.get(doc.id) ?? [],
  }));

  trace.finish({
    found: true,
    chapterCount: chapters.length,
    sectionDocCount: sectionDocs.length,
    annotatedSectionCount: [...annotationsBySectionId.keys()].length,
  });

  return {
    courseTitle: courseSession.title ?? "Untitled Course",
    chapters,
    sectionDocs,
    progressRecord,
    growthFocus: focusSnapshot
      ? {
          directionKey: focusSnapshot.directionKey,
          title: focusSnapshot.title,
          summary: focusSnapshot.summary,
          progress: focusSnapshot.progress,
          state: focusSnapshot.state,
        }
      : null,
    insights: insightRows.map((insight) => ({
      id: insight.id,
      kind: insight.kind as KnowledgeInsight["kind"],
      title: insight.title,
      summary: insight.summary,
      confidence: Number(insight.confidence),
    })),
  };
}

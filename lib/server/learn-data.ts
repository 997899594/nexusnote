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

type SectionAnnotationRow = {
  id: string;
  courseSectionId: string;
  type: string;
  anchor: unknown;
  color: string | null;
  noteContent: string | null;
  createdAt: Date | null;
};

type InsightRow = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  confidence: number | string;
};

type SectionDocRow = {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeKey: string | null;
};

function buildLearnChapters(
  courseSession: NonNullable<Awaited<ReturnType<typeof getOwnedCourseWithOutline>>>,
) {
  return courseSession.outline.chapters.map((chapter, chapterIndex) => ({
    title: chapter.title,
    description: chapter.description ?? "",
    sections: chapter.sections.map((section, sectionIndex) => ({
      title: section.title,
      description: section.description ?? "",
      nodeId: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
    })),
  }));
}

function buildAnnotationsBySectionId(rows: SectionAnnotationRow[]): Map<string, Annotation[]> {
  const annotationsBySectionId = new Map<string, Annotation[]>();

  for (const row of rows) {
    const existing = annotationsBySectionId.get(row.courseSectionId) ?? [];
    existing.push({
      id: row.id,
      type: row.type as "highlight" | "note",
      anchor: row.anchor as {
        textContent: string;
        startOffset: number;
        endOffset: number;
      },
      color: row.color ?? undefined,
      noteContent: row.noteContent ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? "",
    });
    annotationsBySectionId.set(row.courseSectionId, existing);
  }

  return annotationsBySectionId;
}

function buildGrowthFocusSummary(
  focusSnapshot: Awaited<ReturnType<typeof getLatestFocusSnapshot>>,
): GrowthFocusSummary | null {
  if (!focusSnapshot) {
    return null;
  }

  return {
    directionKey: focusSnapshot.directionKey,
    title: focusSnapshot.title,
    summary: focusSnapshot.summary,
    progress: focusSnapshot.progress,
    state: focusSnapshot.state,
  };
}

function buildGrowthInsightSummaries(rows: InsightRow[]): GrowthInsightSummary[] {
  return rows.map((insight) => ({
    id: insight.id,
    kind: insight.kind as KnowledgeInsight["kind"],
    title: insight.title,
    summary: insight.summary,
    confidence: Number(insight.confidence),
  }));
}

function buildSectionDocs(
  rows: SectionDocRow[],
  annotationsBySectionId: Map<string, Annotation[]>,
): LearnPageSnapshot["sectionDocs"] {
  return rows.map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    outlineNodeKey: doc.outlineNodeKey,
    annotations: annotationsBySectionId.get(doc.id) ?? [],
  }));
}

async function loadProgressRecord(userId: string, courseId: string) {
  const rows = await db
    .select({
      currentChapter: courseProgress.currentChapter,
      completedSections: courseProgress.completedSections,
      completedAt: courseProgress.completedAt,
    })
    .from(courseProgress)
    .where(and(eq(courseProgress.courseId, courseId), eq(courseProgress.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

async function loadGrowthInsightRows(userId: string): Promise<InsightRow[]> {
  return db
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
    .limit(3);
}

async function loadSectionDocRows(courseId: string): Promise<SectionDocRow[]> {
  return db
    .select({
      id: courseSections.id,
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeKey: courseSections.outlineNodeKey,
    })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId));
}

async function loadSectionAnnotationRows(
  userId: string,
  courseId: string,
): Promise<SectionAnnotationRow[]> {
  return db
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

  const chapters = buildLearnChapters(courseSession);
  trace.step("course-loaded", {
    chapterCount: chapters.length,
  });

  const [progressRecord, focusSnapshot, insightRows, rawSections, annotations] = await Promise.all([
    loadProgressRecord(userId, courseId),
    getLatestFocusSnapshot(userId),
    loadGrowthInsightRows(userId),
    loadSectionDocRows(courseId),
    loadSectionAnnotationRows(userId, courseId),
  ]);
  trace.step("records-loaded", {
    hasProgress: Boolean(progressRecord),
    sectionDocCount: rawSections.length,
    annotationCount: annotations.length,
  });

  const annotationsBySectionId = buildAnnotationsBySectionId(annotations);
  const sectionDocs = buildSectionDocs(rawSections, annotationsBySectionId);

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
    growthFocus: buildGrowthFocusSummary(focusSnapshot),
    insights: buildGrowthInsightSummaries(insightRows),
  };
}

import "server-only";

import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { courseProgress, courseSectionAnnotations, courseSections, courses, db } from "@/db";
import type { Annotation } from "@/hooks/useAnnotations";
import { getLearnPageTag } from "@/lib/cache/tags";
import { createLearnTrace } from "@/lib/learning/observability";

export interface LearnSectionData {
  title: string;
  description: string;
}

export interface LearnChapterData {
  title: string;
  description: string;
  sections: LearnSectionData[];
}

interface OutlineData {
  title?: string;
  description?: string;
  chapters?: LearnChapterData[];
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
    outlineNodeId: string | null;
    annotations: Annotation[];
  }>;
  progressRecord: {
    currentChapter: number;
    completedSections: string[];
    completedAt: Date | null;
  } | null;
}

export async function getLearnPageSnapshotCached(
  userId: string,
  courseId: string,
): Promise<LearnPageSnapshot | null> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getLearnPageTag(userId, courseId));

  const trace = createLearnTrace("page-snapshot", {
    userId,
    courseId,
  });

  const [courseSession] = await db
    .select({
      id: courses.id,
      title: courses.title,
      outlineData: courses.outlineData,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  if (!courseSession) {
    trace.finish({
      found: false,
    });
    return null;
  }

  const outlineData = courseSession.outlineData as OutlineData | null;
  const chapters = (outlineData?.chapters ?? []).map((ch, chIdx) => ({
    title: ch.title,
    description: ch.description ?? "",
    sections: (ch.sections ?? []).map((sec, secIdx) => ({
      title: sec.title,
      description: sec.description ?? "",
      nodeId: `section-${chIdx + 1}-${secIdx + 1}`,
    })),
  }));
  trace.step("course-loaded", {
    chapterCount: chapters.length,
  });

  const [progressRecord] = await db
    .select({
      currentChapter: courseProgress.currentChapter,
      completedSections: courseProgress.completedSections,
      completedAt: courseProgress.completedAt,
    })
    .from(courseProgress)
    .where(and(eq(courseProgress.courseId, courseId), eq(courseProgress.userId, userId)))
    .limit(1);

  const rawSections = await db
    .select({
      id: courseSections.id,
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeId: courseSections.outlineNodeId,
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
    outlineNodeId: doc.outlineNodeId,
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
    progressRecord: progressRecord ?? null,
  };
}

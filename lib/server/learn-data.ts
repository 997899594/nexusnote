import "server-only";

import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { courseProgress, courseSectionAnnotations, courseSections, db } from "@/db";
import { getCareerTreesTag, getLearnPageTag, getProfileStatsTag } from "@/lib/cache/tags";
import { getUserGrowthContext } from "@/lib/growth/generation-context";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { createLearnTrace } from "@/lib/learning/observability";
import {
  buildLearnPageProjection,
  type LearnPageProjection,
  type LearnProjectionAnnotationRow,
  type LearnProjectionSectionDocRow,
} from "@/lib/learning/projection";

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

async function loadSectionDocRows(courseId: string): Promise<LearnProjectionSectionDocRow[]> {
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
): Promise<LearnProjectionAnnotationRow[]> {
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
): Promise<LearnPageProjection | null> {
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

  trace.step("course-loaded", {
    chapterCount: courseSession.outline.chapters.length,
  });

  const [progressRecord, growthContext, rawSections, annotations] = await Promise.all([
    loadProgressRecord(userId, courseId),
    getUserGrowthContext(userId),
    loadSectionDocRows(courseId),
    loadSectionAnnotationRows(userId, courseId),
  ]);
  trace.step("records-loaded", {
    hasProgress: Boolean(progressRecord),
    sectionDocCount: rawSections.length,
    annotationCount: annotations.length,
  });

  const snapshot = buildLearnPageProjection({
    courseSession,
    progressRecord,
    growthContext,
    sectionDocRows: rawSections,
    annotationRows: annotations,
  });

  trace.finish({
    found: true,
    chapterCount: snapshot.chapters.length,
    sectionDocCount: snapshot.sectionDocs.length,
    annotatedSectionCount: annotations.length,
  });

  return snapshot;
}

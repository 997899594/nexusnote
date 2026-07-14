import "server-only";

import { and, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  coursePublicAnnotations,
  coursePublications,
  courseSectionAnnotations,
  courseSections,
  db,
  desc,
  learningEnrollments,
  learningSectionCompletions,
  users,
} from "@/db";
import { getLearnPageTag } from "@/lib/cache/tags";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { createLearnTrace } from "@/lib/learning/observability";
import {
  buildLearnPageProjection,
  type LearnPageProjection,
  type LearnProjectionAnnotationRow,
  type LearnProjectionPublicAnnotationRow,
  type LearnProjectionSectionDocRow,
} from "@/lib/learning/projection";

async function loadProgressRecord(userId: string, outlineVersionId: string) {
  const [enrollment] = await db
    .select({
      id: learningEnrollments.id,
      startedAt: learningEnrollments.startedAt,
      completedAt: learningEnrollments.completedAt,
    })
    .from(learningEnrollments)
    .where(
      and(
        eq(learningEnrollments.outlineVersionId, outlineVersionId),
        eq(learningEnrollments.userId, userId),
      ),
    )
    .limit(1);

  if (!enrollment) return null;

  const completions = await db
    .select({ sectionId: learningSectionCompletions.sectionId })
    .from(learningSectionCompletions)
    .where(eq(learningSectionCompletions.enrollmentId, enrollment.id));

  return {
    completedSections: completions.map((completion) => completion.sectionId),
    startedAt: enrollment.startedAt,
    completedAt: enrollment.completedAt,
  };
}

async function loadSectionDocRows(
  outlineVersionId: string,
): Promise<LearnProjectionSectionDocRow[]> {
  return db
    .select({
      id: courseSections.id,
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeKey: courseSections.outlineNodeKey,
    })
    .from(courseSections)
    .where(eq(courseSections.outlineVersionId, outlineVersionId));
}

async function loadSectionAnnotationRows(
  userId: string,
  outlineVersionId: string,
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
    .where(
      and(
        eq(courseSectionAnnotations.userId, userId),
        eq(courseSections.outlineVersionId, outlineVersionId),
      ),
    );
}

async function loadPublicAnnotationRows(
  userId: string,
  courseId: string,
): Promise<LearnProjectionPublicAnnotationRow[]> {
  return db
    .select({
      id: coursePublicAnnotations.id,
      sectionKey: coursePublicAnnotations.sectionKey,
      quotedText: coursePublicAnnotations.quotedText,
      body: coursePublicAnnotations.body,
      status: coursePublicAnnotations.status,
      createdAt: coursePublicAnnotations.createdAt,
      authorName: users.name,
      authorImage: users.image,
      publicationSlug: coursePublications.slug,
    })
    .from(coursePublications)
    .innerJoin(
      coursePublicAnnotations,
      and(
        eq(coursePublicAnnotations.publicationId, coursePublications.id),
        eq(coursePublicAnnotations.snapshotId, coursePublications.currentSnapshotId),
      ),
    )
    .innerJoin(users, eq(coursePublicAnnotations.userId, users.id))
    .where(
      and(
        eq(coursePublications.sourceCourseId, courseId),
        eq(coursePublications.ownerUserId, userId),
        eq(coursePublications.status, "published"),
      ),
    )
    .orderBy(desc(coursePublicAnnotations.createdAt));
}

export async function getLearnPageSnapshotCached(
  userId: string,
  courseId: string,
): Promise<LearnPageProjection | null> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getLearnPageTag(userId, courseId));

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

  const [progressRecord, rawSections, annotations, publicAnnotations] = await Promise.all([
    loadProgressRecord(userId, courseSession.outlineVersionId),
    loadSectionDocRows(courseSession.outlineVersionId),
    loadSectionAnnotationRows(userId, courseSession.outlineVersionId),
    loadPublicAnnotationRows(userId, courseId),
  ]);
  trace.step("records-loaded", {
    hasProgress: Boolean(progressRecord),
    sectionDocCount: rawSections.length,
    annotationCount: annotations.length,
    publicAnnotationCount: publicAnnotations.length,
  });

  const snapshot = buildLearnPageProjection({
    courseSession,
    progressRecord,
    sectionDocRows: rawSections,
    annotationRows: annotations,
    publicAnnotationRows: publicAnnotations,
  });

  trace.finish({
    found: true,
    chapterCount: snapshot.chapters.length,
    sectionDocCount: snapshot.sectionDocs.length,
    annotatedSectionCount: annotations.length,
    publicAnnotationCount: publicAnnotations.length,
  });

  return snapshot;
}

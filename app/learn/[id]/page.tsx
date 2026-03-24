/**
 * Learn Page - Server Component
 *
 * Fetches course session data with section-level structure and passes to LearnClient.
 */

export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { courseProgress, courseSectionAnnotations, courseSections, courses, db } from "@/db";
import { auth } from "@/lib/auth";

import { LearnClient } from "./LearnClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

// OutlineData types matching stores/interview.ts
interface SectionData {
  title: string;
  description: string;
}

interface ChapterData {
  title: string;
  description: string;
  sections: SectionData[];
}

interface OutlineData {
  title?: string;
  description?: string;
  chapters?: ChapterData[];
}

export default async function LearnPage({ params, searchParams }: PageProps) {
  const { id: sessionId } = await params;
  const { chapter } = await searchParams;

  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  // Fetch course session (include progress for persisted completedSections)
  const [courseSession] = await db
    .select({
      id: courses.id,
      title: courses.title,
      outlineData: courses.outlineData,
    })
    .from(courses)
    .where(and(eq(courses.id, sessionId), eq(courses.userId, session.user.id)))
    .limit(1);

  if (!courseSession) {
    notFound();
  }

  // Extract structured chapters with sections from outlineData
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

  // Load all section documents for this course
  const [progressRecord] = await db
    .select({
      currentChapter: courseProgress.currentChapter,
      completedSections: courseProgress.completedSections,
      completedAt: courseProgress.completedAt,
    })
    .from(courseProgress)
    .where(and(eq(courseProgress.courseId, sessionId), eq(courseProgress.userId, session.user.id)))
    .limit(1);

  const rawSections = await db
    .select({
      id: courseSections.id,
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeId: courseSections.outlineNodeId,
    })
    .from(courseSections)
    .where(eq(courseSections.courseId, sessionId));

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
    .where(
      and(
        eq(courseSectionAnnotations.userId, session.user.id),
        eq(courseSections.courseId, sessionId),
      ),
    );

  const annotationsBySectionId = new Map<
    string,
    Array<{
      id: string;
      type: "highlight" | "note";
      anchor: { textContent: string; startOffset: number; endOffset: number };
      color?: string;
      noteContent?: string;
      createdAt: string;
    }>
  >();

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
      createdAt: annotation.createdAt?.toISOString() ?? new Date().toISOString(),
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

  // Use persisted learning progress, not content existence
  const initialCompletedSections = progressRecord?.completedSections ?? [];
  const completedSet = new Set(initialCompletedSections);

  // Calculate initial chapter index: explicit ?chapter= param > persisted progress > first incomplete
  let initialChapterIndex: number;
  if (chapter) {
    const chapterNum = parseInt(chapter, 10);
    initialChapterIndex = Number.isNaN(chapterNum) ? 0 : Math.max(0, chapterNum - 1);
  } else {
    // Resume: find first chapter with incomplete sections
    const resumeChapter = chapters.findIndex((ch) =>
      ch.sections.some((sec) => !completedSet.has(sec.nodeId)),
    );
    initialChapterIndex =
      resumeChapter >= 0 ? resumeChapter : (progressRecord?.currentChapter ?? 0);
  }

  // Find first unread section in the resume chapter for auto-scroll
  const resumeChapter = chapters[initialChapterIndex];
  const firstUnreadSection = resumeChapter?.sections.find((sec) => !completedSet.has(sec.nodeId));
  const scrollToSectionId = firstUnreadSection?.nodeId ?? null;

  return (
    <LearnClient
      sessionId={sessionId}
      courseTitle={courseSession.title ?? "Untitled Course"}
      chapters={chapters}
      sectionDocs={sectionDocs}
      initialChapterIndex={initialChapterIndex}
      initialCompletedSections={initialCompletedSections}
      scrollToSectionId={scrollToSectionId}
    />
  );
}

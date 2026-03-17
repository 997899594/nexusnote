/**
 * Learn Page - Server Component
 *
 * Fetches course session data with section-level structure and passes to LearnClient.
 */

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { courseSessions, db, documents } from "@/db";
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
      id: courseSessions.id,
      title: courseSessions.title,
      outlineData: courseSessions.outlineData,
      progress: courseSessions.progress,
    })
    .from(courseSessions)
    .where(eq(courseSessions.id, sessionId))
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
  const rawDocs = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      outlineNodeId: documents.outlineNodeId,
      metadata: documents.metadata,
    })
    .from(documents)
    .where(and(eq(documents.courseId, sessionId), eq(documents.type, "course_section")));

  // Decode Buffer to string before RSC → Client boundary
  const sectionDocs = rawDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content ? Buffer.from(doc.content).toString("utf-8") : null,
    outlineNodeId: doc.outlineNodeId,
    metadata: doc.metadata as {
      annotations?: Array<{
        id: string;
        type: "highlight" | "note";
        anchor: { textContent: string; startOffset: number; endOffset: number };
        color?: string;
        noteContent?: string;
        createdAt: string;
      }>;
    } | null,
  }));

  // Use persisted learning progress, not content existence
  const courseProgress = courseSession.progress as {
    completedSections?: string[];
    currentChapter?: number;
  } | null;
  const initialCompletedSections = courseProgress?.completedSections ?? [];
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
      resumeChapter >= 0 ? resumeChapter : (courseProgress?.currentChapter ?? 0);
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

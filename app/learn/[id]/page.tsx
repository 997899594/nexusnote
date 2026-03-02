/**
 * Learn Page - Server Component
 *
 * Fetches course session data and passes to LearnClient for rendering.
 * Uses Next.js 15+ App Router pattern with async params.
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

// Type for outlineData structure
interface ChapterOutline {
  id: string;
  title: string;
  nodeId: string;
}

interface OutlineData {
  chapters?: ChapterOutline[];
}

// Type for progress structure
interface ProgressData {
  completedChapters?: string[];
}

export default async function LearnPage({ params, searchParams }: PageProps) {
  const { id: sessionId } = await params;
  const { chapter } = await searchParams;

  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  // Fetch course session
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

  // Extract chapters from outlineData
  const outlineData = courseSession.outlineData as OutlineData | null;
  const chapters = (outlineData?.chapters ?? []).map((ch) => ({
    id: ch.id,
    title: ch.title,
    nodeId: ch.nodeId,
  }));

  // Fetch chapter documents
  const chapterDocs = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      outlineNodeId: documents.outlineNodeId,
    })
    .from(documents)
    .where(and(eq(documents.courseId, sessionId), eq(documents.type, "course_chapter")));

  // Calculate initial chapter index (1-indexed from URL, convert to 0-indexed)
  const chapterNum = chapter ? parseInt(chapter, 10) : 1;
  const initialChapterIndex = Number.isNaN(chapterNum) ? 0 : Math.max(0, chapterNum - 1);

  // Extract progress data
  const progress = courseSession.progress as ProgressData | null;

  return (
    <LearnClient
      sessionId={sessionId}
      courseTitle={courseSession.title ?? "Untitled Course"}
      chapters={chapters}
      chapterDocs={chapterDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        outlineNodeId: doc.outlineNodeId,
      }))}
      initialChapterIndex={initialChapterIndex}
      progress={progress}
    />
  );
}

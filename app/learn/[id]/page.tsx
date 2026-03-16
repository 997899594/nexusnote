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

  // Fetch course session
  const [courseSession] = await db
    .select({
      id: courseSessions.id,
      title: courseSessions.title,
      outlineData: courseSessions.outlineData,
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

  // Calculate initial chapter index
  const chapterNum = chapter ? parseInt(chapter, 10) : 1;
  const initialChapterIndex = Number.isNaN(chapterNum) ? 0 : Math.max(0, chapterNum - 1);

  // Compute initial completed sections (sections with non-null content)
  const initialCompletedSections = sectionDocs
    .filter((d) => d.content !== null && d.outlineNodeId !== null)
    .map((d) => d.outlineNodeId!);

  return (
    <LearnClient
      sessionId={sessionId}
      courseTitle={courseSession.title ?? "Untitled Course"}
      chapters={chapters}
      sectionDocs={sectionDocs}
      initialChapterIndex={initialChapterIndex}
      initialCompletedSections={initialCompletedSections}
    />
  );
}

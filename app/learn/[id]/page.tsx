import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createLoginPath } from "@/lib/auth-redirect";
import { getLearnPageSnapshotCached } from "@/lib/server/learn-data";
import { getDynamicPageSession } from "@/lib/server/page-auth";
import { LearnClient } from "./LearnClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

async function LearnPageContent({ params, searchParams }: PageProps) {
  const { id: sessionId } = await params;
  const { chapter } = await searchParams;

  // Verify user is authenticated
  const session = await getDynamicPageSession();
  if (!session?.user?.id) {
    const callbackUrl = chapter ? `/learn/${sessionId}?chapter=${chapter}` : `/learn/${sessionId}`;
    redirect(createLoginPath(callbackUrl));
  }

  const snapshot = await getLearnPageSnapshotCached(session.user.id, sessionId);
  if (!snapshot) {
    notFound();
  }

  // Use persisted learning progress, not content existence
  const initialCompletedSections = snapshot.progressRecord?.completedSections ?? [];
  const completedSet = new Set(initialCompletedSections);

  // Calculate initial chapter index: explicit ?chapter= param > persisted progress > first incomplete
  let initialChapterIndex: number;
  if (chapter) {
    const chapterNum = parseInt(chapter, 10);
    initialChapterIndex = Number.isNaN(chapterNum) ? 0 : Math.max(0, chapterNum - 1);
  } else {
    // Resume: find first chapter with incomplete sections
    const resumeChapter = snapshot.chapters.findIndex((ch) =>
      ch.sections.some((sec) => !completedSet.has(sec.nodeId)),
    );
    initialChapterIndex =
      resumeChapter >= 0 ? resumeChapter : (snapshot.progressRecord?.currentChapter ?? 0);
  }

  // Find first unread section in the resume chapter for auto-scroll
  const resumeChapter = snapshot.chapters[initialChapterIndex];
  const firstUnreadSection = resumeChapter?.sections.find((sec) => !completedSet.has(sec.nodeId));
  const scrollToSectionId = firstUnreadSection?.nodeId ?? null;

  return (
    <LearnClient
      sessionId={sessionId}
      courseTitle={snapshot.courseTitle}
      chapters={snapshot.chapters}
      sectionDocs={snapshot.sectionDocs}
      initialChapterIndex={initialChapterIndex}
      initialCompletedSections={initialCompletedSections}
      scrollToSectionId={scrollToSectionId}
    />
  );
}

export default function LearnPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f7f9]" />}>
      <LearnPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

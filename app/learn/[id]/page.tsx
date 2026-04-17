import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createLoginPath } from "@/lib/auth-redirect";
import { resolveLearnResumeState } from "@/lib/learning/projection";
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

  const resumeState = resolveLearnResumeState(snapshot, chapter);

  return <LearnClient sessionId={sessionId} {...snapshot} {...resumeState} />;
}

export default function LearnPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f7f9]" />}>
      <LearnPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

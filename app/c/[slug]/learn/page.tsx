import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDynamicPageSession } from "@/lib/auth/page";
import { createLoginPath } from "@/lib/auth/redirect";
import { getSubscribedPublicCourseLearnPage } from "@/lib/learning/course-sharing";
import { resolveLearnResumeState } from "@/lib/learning/projection";
import { LearnClient } from "../../../learn/[id]/LearnClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

async function PublicCourseLearnPageContent({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { chapter } = await searchParams;
  const session = await getDynamicPageSession();

  if (!session?.user?.id) {
    const callbackUrl = chapter ? `/c/${slug}/learn?chapter=${chapter}` : `/c/${slug}/learn`;
    redirect(createLoginPath(callbackUrl));
  }

  const data = await getSubscribedPublicCourseLearnPage({
    slug,
    userId: session.user.id,
  });
  if (!data) {
    notFound();
  }

  const resumeState = resolveLearnResumeState(data.snapshot, chapter);

  return (
    <LearnClient
      sessionId={`public:${slug}`}
      learningSource={{ kind: "publication", slug }}
      canModeratePublicAnnotations={data.canModeratePublicAnnotations}
      {...data.snapshot}
      {...resumeState}
    />
  );
}

export default function PublicCourseLearnPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<div className="ui-page-shell min-h-dvh" />}>
      <PublicCourseLearnPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

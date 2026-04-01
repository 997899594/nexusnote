import { Suspense } from "react";
import { requireDynamicPageAuth } from "@/lib/server/page-auth";
import InterviewPageClient from "./InterviewPageClient";

interface InterviewPageProps {
  searchParams: Promise<{ msg?: string }>;
}

async function InterviewPageContent({ searchParams }: InterviewPageProps) {
  const { msg } = await searchParams;
  const callbackUrl = msg ? `/interview?msg=${encodeURIComponent(msg)}` : "/interview";
  await requireDynamicPageAuth(callbackUrl);
  return <InterviewPageClient />;
}

export default function InterviewPage({ searchParams }: InterviewPageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f7f9]" />}>
      <InterviewPageContent searchParams={searchParams} />
    </Suspense>
  );
}

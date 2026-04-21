import { Suspense } from "react";
import { requireDynamicPageAuth } from "@/lib/auth/page";
import InterviewPageClient from "./InterviewPageClient";

interface InterviewPageProps {
  searchParams: Promise<{ msg?: string; mode?: string }>;
}

async function InterviewPageContent({ searchParams }: InterviewPageProps) {
  const { msg, mode } = await searchParams;
  const search = new URLSearchParams();
  if (msg) {
    search.set("msg", msg);
  }
  if (mode) {
    search.set("mode", mode);
  }
  const callbackUrl = search.size > 0 ? `/interview?${search.toString()}` : "/interview";
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

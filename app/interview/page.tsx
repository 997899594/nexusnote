import { requireDynamicPageAuth } from "@/lib/server/page-auth";

import InterviewPageClient from "./InterviewPageClient";

interface InterviewPageProps {
  searchParams: Promise<{ msg?: string }>;
}

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const { msg } = await searchParams;
  const callbackUrl = msg ? `/interview?msg=${encodeURIComponent(msg)}` : "/interview";
  await requireDynamicPageAuth(callbackUrl);
  return <InterviewPageClient />;
}

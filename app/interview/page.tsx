import { requireAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

import InterviewPageClient from "./InterviewPageClient";

interface InterviewPageProps {
  searchParams: Promise<{ msg?: string }>;
}

export default async function InterviewPage({ searchParams }: InterviewPageProps) {
  const { msg } = await searchParams;
  const callbackUrl = msg ? `/interview?msg=${encodeURIComponent(msg)}` : "/interview";
  await requireAuth(callbackUrl);
  return <InterviewPageClient />;
}

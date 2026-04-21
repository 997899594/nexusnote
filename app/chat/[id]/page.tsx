import { Suspense } from "react";
import { requireDynamicPageAuth } from "@/lib/auth/page";
import ChatSessionPageClient from "./ChatSessionPageClient";

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

async function ChatSessionPageContent({ params }: ChatSessionPageProps) {
  const { id } = await params;
  await requireDynamicPageAuth(`/chat/${id}`);
  return <ChatSessionPageClient sessionId={id} />;
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f7f9]" />}>
      <ChatSessionPageContent params={params} />
    </Suspense>
  );
}

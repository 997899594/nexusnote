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
    <Suspense fallback={<div className="ui-page-shell min-h-dvh" />}>
      <ChatSessionPageContent params={params} />
    </Suspense>
  );
}

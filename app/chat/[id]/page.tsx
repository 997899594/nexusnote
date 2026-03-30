import { connection } from "next/server";
import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import ChatSessionPageClient from "./ChatSessionPageClient";

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

async function ChatSessionPageContent({ params }: ChatSessionPageProps) {
  await connection();
  const { id } = await params;
  await requireAuth(`/chat/${id}`);
  return <ChatSessionPageClient sessionId={id} />;
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f7f9]" />}>
      <ChatSessionPageContent params={params} />
    </Suspense>
  );
}

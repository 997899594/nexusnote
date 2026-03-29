import { requireAuth } from "@/lib/auth";
import ChatSessionPageClient from "./ChatSessionPageClient";

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { id } = await params;
  await requireAuth(`/chat/${id}`);
  return <ChatSessionPageClient sessionId={id} />;
}

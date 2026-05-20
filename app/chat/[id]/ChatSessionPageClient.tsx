"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";

interface ChatSessionPageClientProps {
  sessionId: string;
}

export default function ChatSessionPageClient({ sessionId }: ChatSessionPageClientProps) {
  return <ChatPanel sessionId={sessionId} />;
}

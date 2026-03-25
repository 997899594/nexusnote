"use client";

import { ChatPanel } from "@/components/chat";
import { usePendingChatStore } from "@/stores";

interface ChatSessionPageClientProps {
  sessionId: string;
}

export default function ChatSessionPageClient({ sessionId }: ChatSessionPageClientProps) {
  const pendingMessage = usePendingChatStore((s) =>
    s.pending?.id === sessionId ? s.pending.message : null,
  );

  return (
    <div className="flex flex-col h-screen safe-top md:h-full">
      <ChatPanel sessionId={sessionId} pendingMessage={pendingMessage} />
    </div>
  );
}

"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";

interface ChatSessionPageClientProps {
  sessionId: string;
}

export default function ChatSessionPageClient({ sessionId }: ChatSessionPageClientProps) {
  return (
    <div className="ui-page-shell min-h-dvh">
      <div className="ui-page-frame-wide ui-bottom-breathing-room flex min-h-dvh pt-3 md:pt-4">
        <div className="min-h-0 flex-1 overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-[0_24px_56px_-42px_rgba(15,23,42,0.18)]">
          <ChatPanel sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}

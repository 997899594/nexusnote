"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";

interface ChatSessionPageClientProps {
  sessionId: string;
}

export default function ChatSessionPageClient({ sessionId }: ChatSessionPageClientProps) {
  return (
    <div className="ui-page-shell h-full min-h-0">
      <div className="ui-page-frame-wide flex h-full min-h-0 pt-3 pb-4 md:pt-4 md:pb-6">
        <div className="ui-message-card min-h-0 flex-1 overflow-hidden rounded-[30px]">
          <ChatPanel sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}

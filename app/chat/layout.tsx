import { Suspense } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";

interface ChatLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ChatLayoutWrapper({ children }: ChatLayoutWrapperProps) {
  return (
    <Suspense fallback={<div className="ui-page-shell min-h-dvh" />}>
      <ChatLayout>{children}</ChatLayout>
    </Suspense>
  );
}

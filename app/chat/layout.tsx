import { Suspense } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";

interface ChatLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ChatLayoutWrapper({ children }: ChatLayoutWrapperProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f7f9]" />}>
      <ChatLayout>{children}</ChatLayout>
    </Suspense>
  );
}

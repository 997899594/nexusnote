import { ChatLayout } from "@/components/chat/ChatLayout";

interface ChatLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ChatLayoutWrapper({ children }: ChatLayoutWrapperProps) {
  return <ChatLayout>{children}</ChatLayout>;
}

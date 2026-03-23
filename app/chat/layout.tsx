"use client";

/**
 * Chat Layout - /chat 路由的布局包装
 *
 * 提供 ChatLayout 组件和返回首页的处理
 */

import { useRouter } from "next/navigation";
import { ChatLayout } from "@/components/chat";

export default function ChatLayoutWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return <ChatLayout onExit={() => router.push("/")}>{children}</ChatLayout>;
}

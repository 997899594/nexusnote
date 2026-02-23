"use client";

/**
 * Chat Layout - /chat 路由的布局包装
 *
 * 提供 ChatLayout 组件和返回首页的处理
 */

import { ChatLayout } from "@/components/chat";
import { useTransitionStore } from "@/stores";

export default function ChatLayoutWrapper({ children }: { children: React.ReactNode }) {
  const startCollapse = useTransitionStore((state) => state.startCollapse);

  return <ChatLayout onExit={startCollapse}>{children}</ChatLayout>;
}

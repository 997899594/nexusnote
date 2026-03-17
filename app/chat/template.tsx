"use client";

/**
 * Chat Template - 会话切换动效
 *
 * - 会话间切换（/chat/[id] → /chat/[anotherId]）：轻微 fade-in
 * - 从首页过渡进来时（TransitionOverlay active）：跳过 fade，避免双重动画
 */

import { motion } from "framer-motion";
import { useTransitionStore } from "@/stores";

export default function ChatTemplate({ children }: { children: React.ReactNode }) {
  const phase = useTransitionStore((s) => s.phase);
  const skipAnimation = phase !== "idle";

  return (
    <motion.div
      initial={{ opacity: skipAnimation ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

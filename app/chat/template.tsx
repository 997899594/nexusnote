"use client";

/**
 * Chat Template - 会话切换动效
 *
 * 当用户在不同会话之间切换（/chat/[id] → /chat/[anotherId]）时的轻微 fade
 * 不做 slide，避免和 TransitionOverlay 的 expand/collapse 冲突
 */

import { motion } from "framer-motion";

export default function ChatTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

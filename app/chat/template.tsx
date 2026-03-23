"use client";

/**
 * Chat Template - 会话切换动效
 *
 * - 会话间切换（/chat/[id] → /chat/[anotherId]）：轻微 fade-in
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

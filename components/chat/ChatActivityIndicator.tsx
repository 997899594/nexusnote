"use client";

import { motion } from "framer-motion";

interface ChatActivityIndicatorProps {
  label?: string | null;
}

export function ChatActivityIndicator({ label }: ChatActivityIndicatorProps) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs text-[var(--color-text-tertiary)]">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{ duration: 0.78, repeat: Infinity, delay: i * 0.14 }}
            className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]"
          />
        ))}
      </div>
      {label ? <span>{label}</span> : null}
    </div>
  );
}

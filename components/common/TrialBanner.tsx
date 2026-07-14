"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface TrialBannerProps {
  trialEndsAt: string; // ISO date string
}

export function TrialBanner({ trialEndsAt }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  if (daysLeft === 0 || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-[var(--color-accent)] text-white"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <Link href="/pricing" className="flex items-center gap-2 hover:underline">
            <Sparkles className="h-4 w-4" />
            <span>
              Pro 试用还剩 <strong>{daysLeft}</strong> 天 · 查看定价
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-white/20"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

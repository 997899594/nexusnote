"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptChipProps {
  label: string;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export function PromptChip({ label, onClick, icon: Icon, className }: PromptChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-black/6 bg-white/90 px-3.5 py-2 text-sm text-[var(--color-text-secondary)] shadow-[0_16px_32px_-28px_rgba(15,23,42,0.16)] transition-colors hover:bg-[#f3f5f8] hover:text-[var(--color-text)]",
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="truncate">{label}</span>
    </motion.button>
  );
}

export default PromptChip;

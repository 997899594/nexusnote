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
        "ui-control-surface inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]",
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="truncate">{label}</span>
    </motion.button>
  );
}

export default PromptChip;

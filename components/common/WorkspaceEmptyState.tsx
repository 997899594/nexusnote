"use client";

import { motion } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceEmptyStateProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function WorkspaceEmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  footer,
  loading = false,
  className,
}: WorkspaceEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-[28px] border border-black/5 bg-white/92 px-6 py-9 text-center shadow-[0_24px_56px_-40px_rgba(15,23,42,0.16)] md:px-7 md:py-10",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,#f7f8fa_0%,#edf0f4_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-[var(--color-text-secondary)]" />
        ) : Icon ? (
          <Icon className="h-7 w-7 text-[var(--color-text-secondary)]" />
        ) : null}
      </div>

      {eyebrow && (
        <div className="mt-4 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          {eyebrow}
        </div>
      )}

      <h3 className="mt-2 text-base font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>

      {footer && <div className="mt-5">{footer}</div>}
    </motion.div>
  );
}

export default WorkspaceEmptyState;

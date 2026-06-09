import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { StableNavigationTarget } from "@/lib/navigation/app-navigation";
import { cn } from "@/lib/utils";

interface AppBackLinkProps {
  target: StableNavigationTarget;
  variant?: "icon" | "pill" | "soft";
  className?: string;
}

export function AppBackLink({ target, variant = "icon", className }: AppBackLinkProps) {
  if (variant === "pill") {
    return (
      <Link
        href={target.href}
        aria-label={target.ariaLabel}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
          className,
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{target.label}</span>
      </Link>
    );
  }

  if (variant === "soft") {
    return (
      <Link
        href={target.href}
        aria-label={target.ariaLabel}
        className={cn(
          "ui-surface-soft inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]",
          className,
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{target.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={target.href}
      aria-label={target.ariaLabel}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]",
        className,
      )}
    >
      <ArrowLeft className="h-4.5 w-4.5" />
    </Link>
  );
}

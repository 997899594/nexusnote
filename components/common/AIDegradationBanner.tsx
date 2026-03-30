"use client";

import { AlertTriangle, BrainCircuit, SearchX, WifiOff } from "lucide-react";
import {
  type AIDegradationKind,
  getAIDegradationMessage,
  getAIDegradationTitle,
} from "@/lib/ai/core/degradation";
import { cn } from "@/lib/utils";

interface AIDegradationBannerProps {
  kind: AIDegradationKind | null;
  className?: string;
}

function getDegradationIcon(kind: AIDegradationKind) {
  switch (kind) {
    case "chat_unavailable":
      return WifiOff;
    case "structured_unavailable":
      return BrainCircuit;
    case "embedding_unavailable":
      return SearchX;
    default:
      return AlertTriangle;
  }
}

export function AIDegradationBanner({ kind, className }: AIDegradationBannerProps) {
  if (!kind) {
    return null;
  }

  const Icon = getDegradationIcon(kind);

  return (
    <output
      aria-live="polite"
      className={cn(
        "rounded-2xl border border-amber-200/70 bg-amber-50/95 px-4 py-3 text-amber-950 shadow-[0_16px_36px_-30px_rgba(217,119,6,0.35)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{getAIDegradationTitle(kind)}</p>
          <p className="mt-1 text-xs leading-5 text-amber-900/80">
            {getAIDegradationMessage(kind)}
          </p>
        </div>
      </div>
    </output>
  );
}

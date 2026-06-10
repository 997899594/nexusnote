"use client";

import { AlertTriangle, Check, Loader2, RotateCcw, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
import type { ResearchCitation, ResearchRunStatus } from "@/lib/ai/research/contracts";

export interface BackgroundResearchCardState {
  runId: string;
  status: ResearchRunStatus;
  stage?: string;
  progressMessage?: string;
  completedTasks?: number;
  totalTasks?: number;
  failedReason?: string;
  citationCount?: number;
  citations?: ResearchCitation[];
  canCancel?: boolean;
  canRetry?: boolean;
}

interface BackgroundResearchCardProps {
  research: BackgroundResearchCardState;
  onAction: (action: "cancel" | "retry") => void;
  children?: ReactNode;
}

function getStatusLabel(status: ResearchRunStatus) {
  if (status === "completed") {
    return "已完成";
  }
  if (status === "failed") {
    return "失败";
  }
  if (status === "canceled") {
    return "已停止";
  }
  if (status === "cancel_requested") {
    return "停止中";
  }
  return "深度研究";
}

function summarizeQuality(citations: ResearchCitation[] | undefined) {
  const primary = citations?.filter((citation) => citation.qualityTier === "primary").length ?? 0;
  const high = citations?.filter((citation) => citation.qualityTier === "high").length ?? 0;
  return { primary, high };
}

function getProgressLabel(research: BackgroundResearchCardState) {
  if (research.progressMessage) {
    return research.progressMessage;
  }

  if (research.completedTasks != null && research.totalTasks != null) {
    return `${research.completedTasks}/${research.totalTasks}`;
  }

  return research.status === "queued" ? "排队中" : "处理中";
}

export function BackgroundResearchCard({
  research,
  onAction,
  children,
}: BackgroundResearchCardProps) {
  const isRunning =
    research.status !== "completed" &&
    research.status !== "failed" &&
    research.status !== "canceled";
  const quality = summarizeQuality(research.citations);

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white/64 px-3 py-2 text-xs text-[var(--color-text-secondary)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-text-tertiary)]" />
            ) : research.status === "completed" ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            )}
            <span className="font-medium text-[var(--color-text)]">
              {getStatusLabel(research.status)}
            </span>
            <span className="min-w-0 truncate text-[var(--color-text-tertiary)]">
              {getProgressLabel(research)}
            </span>
          </div>
        </div>

        {research.totalTasks != null ? (
          <div className="shrink-0 text-[var(--color-text-tertiary)]">
            {research.completedTasks ?? 0}/{research.totalTasks}
          </div>
        ) : null}
      </div>

      {(research.citations?.length ?? 0) > 0 ? (
        <ResearchSourceStrip
          sources={research.citations}
          label={`来源 ${research.citations?.length ?? 0}`}
          meta={[
            quality.primary > 0 ? `${quality.primary} 个主来源` : null,
            quality.high > 0 ? `${quality.high} 个高质量` : null,
          ]}
          isRunning={isRunning}
          variant="compact"
          className="mt-1.5"
        />
      ) : null}

      {research.status === "failed" ? (
        <p className="mt-2 text-xs leading-5 text-amber-800">
          {research.failedReason ?? "研究失败。"}
        </p>
      ) : null}

      {research.status === "canceled" ? (
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">已停止。</p>
      ) : null}

      {(research.canCancel || research.canRetry) && (
        <div className="mt-2 flex items-center gap-2">
          {research.canCancel ? (
            <button
              type="button"
              onClick={() => onAction("cancel")}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--color-text)]"
            >
              <XCircle className="h-3.5 w-3.5" />
              停止
            </button>
          ) : null}
          {research.canRetry ? (
            <button
              type="button"
              onClick={() => onAction("retry")}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--color-text)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重试
            </button>
          ) : null}
        </div>
      )}

      {children ? (
        <div className="mt-2 max-h-80 overflow-y-auto border-black/[0.04] border-t pt-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

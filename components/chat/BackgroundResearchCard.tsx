"use client";

import { AlertTriangle, Check, Circle, Loader2, RotateCcw, Square, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ResearchEvidenceStack } from "@/components/research/ResearchEvidenceStack";
import type { ResearchCitation, ResearchRunStatus } from "@/lib/ai/research/contracts";
import { cn } from "@/lib/utils";

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

const PIPELINE = [
  { key: "planning", label: "计划" },
  { key: "researching", label: "读取" },
  { key: "synthesizing", label: "综合" },
  { key: "persisting", label: "写回" },
] as const;

const STAGE_INDEX: Record<string, number> = {
  queued: 0,
  planning: 0,
  researching: 1,
  synthesizing: 2,
  persisting: 3,
  completed: 4,
};

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

function getActiveIndex(research: BackgroundResearchCardState) {
  if (research.status === "completed") {
    return PIPELINE.length;
  }
  if (research.status === "failed" || research.status === "canceled") {
    return -1;
  }

  return STAGE_INDEX[research.stage ?? research.status] ?? 0;
}

function summarizeQuality(citations: ResearchCitation[] | undefined) {
  const primary = citations?.filter((citation) => citation.qualityTier === "primary").length ?? 0;
  const high = citations?.filter((citation) => citation.qualityTier === "high").length ?? 0;
  return { primary, high };
}

export function BackgroundResearchCard({
  research,
  onAction,
  children,
}: BackgroundResearchCardProps) {
  const activeIndex = getActiveIndex(research);
  const isRunning =
    research.status !== "completed" &&
    research.status !== "failed" &&
    research.status !== "canceled";
  const quality = summarizeQuality(research.citations);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#fbfaf5]/90 p-4 text-sm text-[var(--color-text)] shadow-[0_18px_54px_rgba(42,38,28,0.08)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-text-tertiary)]" />
            ) : research.status === "completed" ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            )}
            <span className="font-medium tracking-[-0.01em]">
              {getStatusLabel(research.status)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
            {research.progressMessage ?? "准备检索源。"}
          </p>
        </div>

        {research.totalTasks != null ? (
          <div className="shrink-0 rounded-full border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
            {research.completedTasks ?? 0}/{research.totalTasks}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {PIPELINE.map((step, index) => {
          const done = activeIndex > index;
          const active = activeIndex === index && isRunning;
          return (
            <div key={step.key} className="min-w-0">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done ? "bg-stone-900" : active ? "bg-stone-400" : "bg-black/[0.07]",
                )}
              />
              <div className="mt-1.5 flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {done ? (
                  <Check className="h-3 w-3" />
                ) : active ? (
                  <Circle className="h-2.5 w-2.5 fill-current" />
                ) : (
                  <Square className="h-2.5 w-2.5" />
                )}
                <span className="truncate">{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <ResearchEvidenceStack
        citations={research.citations}
        isRunning={isRunning}
        compact
        className="mt-4"
      />

      {research.status === "failed" ? (
        <p className="mt-4 text-xs leading-5 text-amber-800">
          {research.failedReason ?? "研究失败。"}
        </p>
      ) : null}

      {research.status === "canceled" ? (
        <p className="mt-4 text-xs leading-5 text-[var(--color-text-secondary)]">已停止。</p>
      ) : null}

      {(research.citationCount ?? 0) > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-tertiary)]">
          <span className="rounded-full bg-white/64 px-2.5 py-1">
            {research.citationCount} 个来源
          </span>
          {quality.primary > 0 ? (
            <span className="rounded-full bg-white/64 px-2.5 py-1">{quality.primary} 个主来源</span>
          ) : null}
          {quality.high > 0 ? (
            <span className="rounded-full bg-white/64 px-2.5 py-1">
              {quality.high} 个高质量来源
            </span>
          ) : null}
        </div>
      ) : null}

      {(research.canCancel || research.canRetry) && (
        <div className="mt-4 flex items-center gap-2">
          {research.canCancel ? (
            <button
              type="button"
              onClick={() => onAction("cancel")}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-text)]"
            >
              <XCircle className="h-3.5 w-3.5" />
              停止
            </button>
          ) : null}
          {research.canRetry ? (
            <button
              type="button"
              onClick={() => onAction("retry")}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-text)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重试
            </button>
          ) : null}
        </div>
      )}

      {children ? <div className="mt-4 rounded-2xl bg-white/58 px-3 py-3">{children}</div> : null}
    </div>
  );
}

"use client";

import { Check, Loader2 } from "lucide-react";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
import type { InterviewResearchEvent } from "@/lib/ai/interview/research-events";
import type { ResearchEvidenceSnapshot } from "@/lib/ai/research/evidence-snapshot";
import { cn } from "@/lib/utils";

interface InterviewResearchActivityProps {
  evidence?: ResearchEvidenceSnapshot | null;
  events?: InterviewResearchEvent[];
  defaultOpen?: boolean;
  isRunning?: boolean;
}

export function InterviewResearchActivity({
  evidence,
  events = [],
  defaultOpen = false,
  isRunning = false,
}: InterviewResearchActivityProps) {
  const latestEvent = events.at(-1);
  const latestProgress = latestEvent?.kind === "progress" ? latestEvent.progress : undefined;
  const completedEvidence =
    evidence ?? (latestEvent?.kind === "completed" ? latestEvent.evidence : null);
  const sourceCount =
    completedEvidence?.summary.sourceCount ??
    (latestProgress && "sourceCount" in latestProgress ? latestProgress.sourceCount : 0);
  const extractedCount =
    completedEvidence?.summary.extractedCount ??
    (latestProgress && "extractedCount" in latestProgress ? latestProgress.extractedCount : 0);
  const authoritativeCount = completedEvidence?.summary.authoritativeCount ?? 0;
  const freshnessWindowDays =
    completedEvidence?.freshnessWindowDays ??
    (
      events.find((event) => event.kind === "started") as
        | Extract<InterviewResearchEvent, { kind: "started" }>
        | undefined
    )?.freshnessWindowDays;
  const isReady = completedEvidence?.status === "ready";
  const isUnavailable = completedEvidence?.status === "unavailable";
  const unavailableReason = completedEvidence?.unavailableReason;
  const unavailableLabel =
    unavailableReason === "not_configured" || unavailableReason === "disabled"
      ? "检索未启用"
      : unavailableReason === "provider_error"
        ? "检索服务异常"
        : "未找到来源";
  const unavailableText =
    unavailableReason === "not_configured" || unavailableReason === "disabled"
      ? "检索服务未启用。"
      : unavailableReason === "provider_error"
        ? "检索服务异常，本轮未完成来源校准。"
        : "未找到可用来源。";
  const statusText = isUnavailable
    ? unavailableLabel
    : isReady
      ? `已检索 ${sourceCount} 个来源`
      : latestProgress?.stage === "reading"
        ? `读取 ${sourceCount || "外部"} 个来源`
        : latestProgress?.stage === "ranking"
          ? "筛选可信来源"
          : latestProgress?.stage === "searched"
            ? `找到 ${latestProgress.resultCount} 条结果`
            : sourceCount > 0
              ? `找到 ${sourceCount} 个来源`
              : "资料校准";
  const meta = [
    extractedCount > 0 ? `${extractedCount} 篇原文` : null,
    authoritativeCount > 0 ? `${authoritativeCount} 个优先来源` : null,
    freshnessWindowDays ? `${freshnessWindowDays} 天` : null,
  ];

  if (completedEvidence) {
    return (
      <ResearchSourceStrip
        sources={completedEvidence.sources}
        label={statusText}
        meta={meta}
        defaultOpen={defaultOpen && !isReady}
        isRunning={!isReady && isRunning}
        emptyText={isUnavailable ? unavailableText : undefined}
        variant="compact"
        className="mb-2 max-w-[min(100%,42rem)]"
      />
    );
  }

  return (
    <div className="mb-2 flex max-w-[min(100%,42rem)] items-center gap-2 py-1 text-xs text-[var(--color-text-tertiary)]">
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-text-tertiary)]" />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
      )}
      <span className="font-medium text-[var(--color-text)]">{statusText}</span>
      <span
        className={cn(
          "h-1 w-1 rounded-full bg-[var(--color-text-muted)]",
          !meta.some(Boolean) && "hidden",
        )}
      />
      {meta.some(Boolean) ? (
        <span className="min-w-0 truncate text-[var(--color-text-tertiary)]">
          {meta.filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
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
  const statusText = isReady
    ? `来源 ${sourceCount}`
    : latestProgress?.stage === "reading"
      ? `读取 ${sourceCount} 个来源`
      : latestProgress?.stage === "ranking"
        ? "筛选可信来源"
        : latestProgress?.stage === "searched"
          ? `找到 ${latestProgress.resultCount} 条结果`
          : sourceCount > 0
            ? `找到 ${sourceCount} 个来源`
            : "检索外部资料";
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
        defaultOpen={defaultOpen}
        isRunning={!isReady && isRunning}
        className="mb-3"
      />
    );
  }

  return (
    <div className="mb-3 flex items-center gap-2 border-black/[0.06] border-y py-2 text-xs text-[var(--color-text-secondary)]">
      <Search
        className={cn(
          "h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]",
          isRunning && "animate-pulse",
        )}
      />
      <span className="font-medium text-[var(--color-text)]">{statusText}</span>
      {meta.some(Boolean) ? (
        <span className="min-w-0 truncate text-[var(--color-text-tertiary)]">
          {meta.filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { Check, ChevronDown, ExternalLink, Search, Sparkles } from "lucide-react";
import type { InterviewResearchEvent } from "@/lib/ai/interview/research-events";
import type { ResearchEvidenceSnapshot } from "@/lib/ai/research/evidence-snapshot";
import { cn } from "@/lib/utils";

interface InterviewResearchActivityProps {
  evidence?: ResearchEvidenceSnapshot | null;
  events?: InterviewResearchEvent[];
  defaultOpen?: boolean;
  isRunning?: boolean;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_docs: "官方",
  release_note: "版本",
  paper: "论文",
  source_code: "源码",
  technical_blog: "技术文",
  news: "新闻",
  community: "社区",
  seo_aggregator: "聚合",
  unknown: "来源",
};

function getSourceTypeLabel(value: string | undefined): string {
  return value ? (SOURCE_TYPE_LABELS[value] ?? value) : "来源";
}

function getDomainLabel(domain: string): string {
  return domain.replace(/^www\./u, "");
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
  const visibleSources = completedEvidence?.sources.slice(0, 5) ?? [];
  const isReady = completedEvidence?.status === "ready";
  const statusText = isReady
    ? `已查看 ${sourceCount} 个来源`
    : latestProgress?.stage === "reading"
      ? `正在读取 ${sourceCount} 个来源`
      : latestProgress?.stage === "ranking"
        ? "正在筛选可信来源"
        : latestProgress?.stage === "searched"
          ? `已找到 ${latestProgress.resultCount} 条结果`
          : sourceCount > 0
            ? `已找到 ${sourceCount} 个来源`
            : "正在检索外部资料";

  return (
    <details
      className="group mb-3 overflow-hidden rounded-[22px] border border-black/[0.06] bg-[#fbfaf6] shadow-[0_14px_40px_rgba(20,18,14,0.05)]"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isReady ? "bg-stone-950 text-white" : "bg-amber-100 text-amber-900",
          )}
        >
          {isReady ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Search className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[var(--color-text)]">{statusText}</span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--color-text-tertiary)]">
            {extractedCount} 篇原文 · {authoritativeCount} 个高质量来源
            {freshnessWindowDays ? ` · ${freshnessWindowDays} 天窗口` : ""}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-black/[0.05] border-t px-3.5 pb-3.5 pt-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>本轮资料只用于校准方向，蓝图仍取决于你的目标、基础和产出。</span>
        </div>
        {visibleSources.length > 0 ? (
          <div className="space-y-1.5">
            {visibleSources.map((source) => (
              <a
                key={`${source.id}-${source.url}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="group/source flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-[var(--color-text-secondary)] ring-1 ring-black/[0.04] transition-colors hover:bg-white hover:text-[var(--color-text)]"
              >
                <span className="shrink-0 rounded-md bg-stone-950 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {source.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{source.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-[var(--color-text-tertiary)]">
                    {getDomainLabel(source.domain)} · {getSourceTypeLabel(source.sourceType)}
                  </span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-colors group-hover/source:text-[var(--color-text-secondary)]" />
              </a>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white/70 px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            暂时没有可展示来源。回答会避免假装完成联网核验。
          </p>
        )}
      </div>
    </details>
  );
}

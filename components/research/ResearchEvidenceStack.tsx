import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResearchEvidenceStackCitation {
  provider?: string;
  extractProvider?: string;
  sourceType?: string;
  qualityTier?: string;
  domain?: string;
}

interface ResearchEvidenceStackProps {
  citations?: ResearchEvidenceStackCitation[];
  isRunning?: boolean;
  compact?: boolean;
  className?: string;
}

const PROVIDER_NODES = [
  {
    id: "tavily",
    label: "Tavily",
    detail: "search + extract",
    matches: (citation: ResearchEvidenceStackCitation) =>
      citation.provider === "tavily" || citation.extractProvider === "tavily-extract",
  },
  {
    id: "exa",
    label: "Exa",
    detail: "semantic web",
    matches: (citation: ResearchEvidenceStackCitation) =>
      citation.provider === "exa" || citation.extractProvider === "exa-contents",
  },
  {
    id: "jina",
    label: "Jina",
    detail: "search + reader",
    matches: (citation: ResearchEvidenceStackCitation) =>
      citation.provider === "jina-search" || citation.extractProvider === "jina-reader",
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    detail: "page read",
    matches: (citation: ResearchEvidenceStackCitation) => citation.extractProvider === "firecrawl",
  },
] as const;

const QUALITY_LABELS: Record<string, string> = {
  primary: "主来源",
  high: "高质量",
  standard: "标准",
  low: "低置信",
};

function getProviderState(citations: ResearchEvidenceStackCitation[]) {
  return PROVIDER_NODES.map((node) => ({
    ...node,
    active: citations.some(node.matches),
  }));
}

function summarize(citations: ResearchEvidenceStackCitation[]) {
  const primary = citations.filter((citation) => citation.qualityTier === "primary").length;
  const high = citations.filter((citation) => citation.qualityTier === "high").length;
  const domains = new Set(citations.map((citation) => citation.domain).filter(Boolean)).size;
  const strongestTier = primary > 0 ? "primary" : high > 0 ? "high" : citations[0]?.qualityTier;

  return {
    domains,
    label: strongestTier ? QUALITY_LABELS[strongestTier] : "已核验",
  };
}

export function ResearchEvidenceStack({
  citations = [],
  isRunning,
  compact,
  className,
}: ResearchEvidenceStackProps) {
  if (citations.length === 0 && !isRunning) {
    return null;
  }

  const providerState = getProviderState(citations);
  const activeCount = providerState.filter((provider) => provider.active).length;
  const summary = summarize(citations);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-black/[0.06] bg-[#f8f5ed]/86 text-[var(--color-text)]",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            Research Stack
          </div>
          <p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            联网核验
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
          {citations.length > 0 ? `${citations.length} sources` : isRunning ? "running" : "idle"}
        </div>
      </div>

      <div className={cn("grid gap-2", compact ? "mt-3 grid-cols-2" : "mt-4 grid-cols-4")}>
        {providerState.map((provider) => (
          <div
            key={provider.id}
            className={cn(
              "rounded-2xl border px-3 py-2 transition-colors",
              provider.active
                ? "border-stone-900/12 bg-white/76"
                : "border-black/[0.04] bg-white/36 text-[var(--color-text-tertiary)]",
            )}
          >
            <div
              className={cn(
                "mb-2 h-1 rounded-full",
                provider.active ? "bg-stone-900" : isRunning ? "bg-stone-300" : "bg-black/[0.07]",
              )}
            />
            <div className="flex items-center gap-1.5">
              {provider.active ? (
                <Check className="h-3 w-3 text-stone-900" />
              ) : (
                <Circle className="h-2.5 w-2.5 text-[var(--color-text-muted)]" />
              )}
              <span className="truncate text-xs font-semibold">{provider.label}</span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-tertiary)]">
              {provider.detail}
            </p>
          </div>
        ))}
      </div>

      {citations.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-tertiary)]">
          <span className="rounded-full bg-white/64 px-2.5 py-1">{activeCount} 路命中</span>
          <span className="rounded-full bg-white/64 px-2.5 py-1">{summary.label}</span>
          {summary.domains > 0 ? (
            <span className="rounded-full bg-white/64 px-2.5 py-1">{summary.domains} domains</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

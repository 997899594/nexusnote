import { Check, ChevronDown, Circle, Loader2 } from "lucide-react";
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

const PRODUCT_STEPS = ["检索权威来源", "读取原文", "去重重排", "生成蓝图"] as const;

const AUTHORITATIVE_TYPES = new Set([
  "official_docs",
  "release_note",
  "paper",
  "source_code",
  "technical_blog",
]);

function getProviderState(citations: ResearchEvidenceStackCitation[]) {
  return PROVIDER_NODES.map((node) => ({
    ...node,
    active: citations.some(node.matches),
  }));
}

function getQuality(citations: ResearchEvidenceStackCitation[]) {
  const primary = citations.filter((citation) => citation.qualityTier === "primary").length;
  const high = citations.filter((citation) => citation.qualityTier === "high").length;
  const authoritative = citations.filter((citation) =>
    citation.sourceType ? AUTHORITATIVE_TYPES.has(citation.sourceType) : false,
  ).length;
  const extracted = citations.filter((citation) =>
    citation.extractProvider ? citation.extractProvider !== "search-snippet" : false,
  ).length;
  const domains = new Set(citations.map((citation) => citation.domain).filter(Boolean)).size;

  const score = primary * 3 + high * 2 + authoritative + extracted;
  const label = score >= 10 ? "强" : score >= 5 ? "稳" : citations.length > 0 ? "基础" : "准备中";

  return {
    authoritative,
    domains,
    extracted,
    high,
    label,
    primary,
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
  const activeProviders = providerState.filter((provider) => provider.active);
  const quality = getQuality(citations);
  const completedSteps = citations.length > 0 ? PRODUCT_STEPS.length : isRunning ? 2 : 0;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-black/[0.06] bg-[#f8f5ed]/86 text-[var(--color-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
        compact ? "p-3" : "p-4",
        className,
      )}
      aria-label="联网核验证据质量"
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            Evidence Quality
          </div>
          <div className="mt-1 flex items-center gap-2">
            {isRunning && citations.length === 0 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-text-tertiary)]" />
            ) : (
              <Check className="h-3.5 w-3.5 text-stone-900" />
            )}
            <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
              {citations.length > 0 ? "已联网核验" : "正在联网核验"}
            </p>
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
          证据质量：{quality.label}
        </div>
      </div>

      <div className={cn("mt-4 grid gap-2", compact ? "grid-cols-2" : "grid-cols-4")}>
        <div className="rounded-2xl bg-white/62 px-3 py-2">
          <div className="text-base font-semibold tracking-[-0.03em]">{citations.length}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            来源
          </div>
        </div>
        <div className="rounded-2xl bg-white/62 px-3 py-2">
          <div className="text-base font-semibold tracking-[-0.03em]">{quality.authoritative}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            权威
          </div>
        </div>
        <div className="rounded-2xl bg-white/62 px-3 py-2">
          <div className="text-base font-semibold tracking-[-0.03em]">{quality.extracted}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            原文
          </div>
        </div>
        <div className="rounded-2xl bg-white/62 px-3 py-2">
          <div className="text-base font-semibold tracking-[-0.03em]">{quality.domains}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            域名
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {PRODUCT_STEPS.map((step, index) => {
          const done = completedSteps > index;
          const active = isRunning && completedSteps === index;
          return (
            <div key={step} className="min-w-0">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done ? "bg-stone-900" : active ? "bg-stone-400" : "bg-black/[0.07]",
                )}
              />
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
                {done ? (
                  <Check className="h-3 w-3" />
                ) : active ? (
                  <Circle className="h-2.5 w-2.5 fill-current" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
                <span className="truncate">{step}</span>
              </div>
            </div>
          );
        })}
      </div>

      {citations.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-tertiary)]">
          <span className="rounded-full bg-white/64 px-2.5 py-1">
            {activeProviders.length} 路检索
          </span>
          {quality.primary > 0 ? (
            <span className="rounded-full bg-white/64 px-2.5 py-1">{quality.primary} 个主来源</span>
          ) : null}
          {quality.high > 0 ? (
            <span className="rounded-full bg-white/64 px-2.5 py-1">{quality.high} 个高质量</span>
          ) : null}
        </div>
      ) : null}

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-white/42 px-3 py-2 text-[11px] font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-white/62 hover:text-[var(--color-text-secondary)]">
          <span>技术细节</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className={cn("grid gap-2 pt-2", compact ? "grid-cols-2" : "grid-cols-4")}>
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
      </details>
    </section>
  );
}

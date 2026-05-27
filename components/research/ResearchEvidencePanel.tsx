import { AlertTriangle, Check, Circle, ExternalLink } from "lucide-react";
import type {
  ResearchEvidenceSnapshot,
  ResearchEvidenceSnapshotSource,
} from "@/lib/ai/research/evidence-snapshot";
import { cn } from "@/lib/utils";

interface ResearchEvidencePanelProps {
  evidence: ResearchEvidenceSnapshot | null | undefined;
  isRunning?: boolean;
  compact?: boolean;
  className?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  tavily: "Tavily",
  exa: "Exa",
  "jina-search": "Jina",
  "tavily-extract": "Tavily Extract",
  firecrawl: "Firecrawl",
  "jina-reader": "Jina Reader",
  "exa-contents": "Exa Contents",
  reranker: "Reranker",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_docs: "官方文档",
  release_note: "版本记录",
  paper: "论文",
  source_code: "源码",
  technical_blog: "技术文章",
  news: "新闻",
  community: "社区",
  seo_aggregator: "聚合页",
  unknown: "来源",
};

const QUALITY_LABELS: Record<string, string> = {
  primary: "主来源",
  high: "高质量",
  standard: "标准",
  low: "低置信",
};

function providerLabel(provider: string | undefined): string {
  if (!provider) {
    return "unknown";
  }

  return PROVIDER_LABELS[provider] ?? provider;
}

function sourceMeta(source: ResearchEvidenceSnapshotSource): string {
  return [
    source.domain,
    providerLabel(source.provider),
    source.extractProvider ? providerLabel(source.extractProvider) : null,
    SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType,
    QUALITY_LABELS[source.qualityTier] ?? source.qualityTier,
  ]
    .filter(Boolean)
    .join(" · ");
}

function evidenceExcerpt(source: ResearchEvidenceSnapshotSource): string {
  const chunk = source.evidenceChunks[0]?.text ?? source.contentPreview ?? source.snippet;
  return chunk.replace(/\s+/gu, " ").trim();
}

function getProviderTraceSummary(evidence: ResearchEvidenceSnapshot) {
  const used = evidence.providerTrace.filter((trace) => trace.status === "used").length;
  const failed = evidence.providerTrace.filter((trace) => trace.status === "failed").length;
  const skipped = evidence.providerTrace.filter((trace) => trace.status === "skipped").length;
  return { failed, skipped, used };
}

export function ResearchEvidencePanel({
  evidence,
  isRunning,
  compact,
  className,
}: ResearchEvidencePanelProps) {
  if (!evidence) {
    return null;
  }

  const traceSummary = getProviderTraceSummary(evidence);
  const visibleSources = evidence.sources.slice(0, compact ? 4 : 8);

  return (
    <section
      className={cn(
        "rounded-[24px] border border-black/[0.06] bg-[#f8f5ed]/88 p-3 text-[var(--color-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
        className,
      )}
      aria-label="联网核验证据链"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
            Evidence Trace
          </p>
          <div className="mt-1 flex items-center gap-2">
            {evidence.status === "ready" ? (
              <Check className="h-3.5 w-3.5 text-stone-900" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            )}
            <h4 className="truncate text-sm font-semibold tracking-[-0.02em]">
              {evidence.status === "ready" ? "已完成联网核验" : "联网核验未完成"}
            </h4>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
          {evidence.freshnessWindowDays} 天窗口
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="查询" value={evidence.summary.queryCount} />
        <Metric label="来源" value={evidence.summary.sourceCount} />
        <Metric label="原文" value={evidence.summary.extractedCount} />
        <Metric label="权威" value={evidence.summary.authoritativeCount} />
        <Metric label="域名" value={evidence.summary.domainCount} />
        <Metric label="Provider" value={evidence.summary.providerCount} />
      </div>

      <details className="group mt-3" open={!compact && evidence.sources.length > 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-white/50 px-3 py-2 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/70">
          <span>检索问题与来源证据</span>
          <span className="text-[var(--color-text-tertiary)]">
            {traceSummary.used} used / {traceSummary.failed} failed / {traceSummary.skipped} skipped
          </span>
        </summary>

        <div className="space-y-3 pt-3">
          <div className="space-y-1.5">
            {evidence.queries.map((query, index) => (
              <div
                key={query}
                className="rounded-2xl bg-white/62 px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]"
              >
                <span className="mr-2 font-semibold text-[var(--color-text)]">Q{index + 1}</span>
                {query}
              </div>
            ))}
          </div>

          {visibleSources.length > 0 ? (
            <div className="space-y-2">
              {visibleSources.map((source) => (
                <a
                  key={`${source.id}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-2xl border border-black/[0.04] bg-white/62 p-3 transition-colors hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {source.id}
                        </span>
                        <h5 className="truncate text-xs font-semibold text-[var(--color-text)]">
                          {source.title}
                        </h5>
                      </div>
                      <p className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        {sourceMeta(source)}
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-secondary)]" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                    {evidenceExcerpt(source)}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                    <Circle className="h-2 w-2 fill-current" />
                    <span className="truncate">Query: {source.searchQuery}</span>
                  </div>
                </a>
              ))}
            </div>
          ) : null}

          {evidence.errors.length > 0 ? (
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {evidence.errors[0]}
            </div>
          ) : null}
        </div>
      </details>

      {isRunning && evidence.sources.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">正在读取外部来源。</p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/62 px-3 py-2">
      <div className="text-base font-semibold tracking-[-0.03em]">{value}</div>
      <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        {label}
      </div>
    </div>
  );
}

"use client";

import { Check, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface ResearchSourceStripSource {
  id?: string;
  title: string;
  url: string;
  domain?: string;
  sourceType?: string;
  qualityTier?: string;
  provider?: string;
  extractProvider?: string;
  publishedAt?: string;
  snippet?: string;
}

interface ResearchSourceStripProps {
  sources?: ResearchSourceStripSource[];
  label?: string;
  meta?: Array<string | null | undefined | false>;
  isRunning?: boolean;
  defaultOpen?: boolean;
  maxVisible?: number;
  className?: string;
  emptyText?: string;
  variant?: "card" | "compact";
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
  note: "笔记",
  conversation: "对话",
  unknown: "来源",
};

const QUALITY_LABELS: Record<string, string> = {
  primary: "主来源",
  high: "高质量",
  standard: "标准",
  low: "低置信",
};

const SITE_NAME_OVERRIDES: Record<string, string> = {
  "github.com": "GitHub",
  "openai.com": "OpenAI",
  "platform.openai.com": "OpenAI Docs",
  "anthropic.com": "Anthropic",
  "docs.anthropic.com": "Anthropic Docs",
  "claude.com": "Claude",
  "support.claude.com": "Claude Help",
  "react.dev": "React",
  "nextjs.org": "Next.js",
  "developer.mozilla.org": "MDN",
  "vercel.com": "Vercel",
  "ai.google.dev": "Google AI",
  "arxiv.org": "arXiv",
  "huggingface.co": "Hugging Face",
  "qwenlm.github.io": "Qwen",
  "deepseek.com": "DeepSeek",
};

function getDomainLabel(source: ResearchSourceStripSource): string {
  const value = source.domain ?? source.url;
  try {
    return new URL(value).hostname.replace(/^www\./u, "");
  } catch {
    return value.replace(/^www\./u, "");
  }
}

function getSiteName(source: ResearchSourceStripSource): string {
  const domain = getDomainLabel(source).toLowerCase();
  const override = SITE_NAME_OVERRIDES[domain];
  if (override) {
    return override;
  }

  const parts = domain.split(".").filter(Boolean);
  const base = parts.length > 1 ? parts.at(-2) : parts[0];
  if (!base) {
    return domain || "来源";
  }

  return base
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getFaviconUrl(source: ResearchSourceStripSource): string {
  const domain = getDomainLabel(source);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function getSourceTypeLabel(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return SOURCE_TYPE_LABELS[value] ?? value;
}

function getQualityLabel(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return QUALITY_LABELS[value] ?? value;
}

function compactMeta(parts: Array<string | null | undefined | false>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function isExternalHref(url: string): boolean {
  return /^https?:\/\//u.test(url);
}

function SourceFavicon({ source }: { source: ResearchSourceStripSource }) {
  const siteName = getSiteName(source);

  return (
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/[0.06] bg-black/[0.025] text-[10px] font-medium text-[var(--color-text-tertiary)]">
      {siteName.slice(0, 1)}
      <Image
        src={getFaviconUrl(source)}
        alt=""
        width={20}
        height={20}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        unoptimized
      />
    </span>
  );
}

export function ResearchSourceStrip({
  sources = [],
  label,
  meta = [],
  isRunning,
  defaultOpen = false,
  maxVisible = 5,
  className,
  emptyText = "暂无可展示来源",
  variant = "card",
}: ResearchSourceStripProps) {
  const visibleSources = sources.slice(0, maxVisible);
  const sourceCount = sources.length;
  const summaryLabel =
    label ?? (isRunning ? "正在检索来源" : sourceCount > 0 ? `来源 ${sourceCount}` : "来源");
  const summaryMeta = compactMeta(meta);
  const isCompact = variant === "compact";
  const shellClassName = cn(
    isCompact
      ? "group text-xs text-[var(--color-text-secondary)]"
      : "group rounded-[20px] border border-black/[0.06] bg-white/72 px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-[0_12px_40px_-34px_rgba(15,23,42,0.35)]",
    className,
  );
  const summaryClassName = cn(
    "flex cursor-pointer list-none items-center gap-2",
    isCompact
      ? "rounded-lg px-0 py-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
      : "rounded-full",
  );
  const bodyClassName = cn(
    isCompact ? "mt-1.5 space-y-0.5 pl-5" : "mt-2 space-y-1 border-black/[0.04] border-t pt-2",
  );

  if (sourceCount === 0) {
    return (
      <details className={shellClassName} open={defaultOpen}>
        <summary className={summaryClassName}>
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-text-tertiary)]" />
          ) : (
            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
          )}
          <span className="shrink-0 font-medium text-[var(--color-text)]">{summaryLabel}</span>
          {summaryMeta ? (
            <span className="min-w-0 flex-1 truncate text-[var(--color-text-tertiary)]">
              {summaryMeta}
            </span>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
        </summary>
        <p
          className={cn(
            "text-[var(--color-text-tertiary)]",
            isCompact ? "mt-1.5 pl-5" : "mt-2 border-black/[0.04] border-t px-1.5 pt-2",
          )}
        >
          {isRunning ? "正在读取外部来源。" : emptyText}
        </p>
      </details>
    );
  }

  return (
    <details className={shellClassName} open={defaultOpen}>
      <summary className={summaryClassName}>
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-text-tertiary)]" />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
        )}
        <span className="shrink-0 font-medium text-[var(--color-text)]">{summaryLabel}</span>
        {summaryMeta ? (
          <span className="min-w-0 flex-1 truncate text-[var(--color-text-tertiary)]">
            {summaryMeta}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <div className={bodyClassName}>
        {visibleSources.length > 0 ? (
          visibleSources.map((source, index) => (
            <a
              key={`${source.id ?? index}-${source.url}`}
              href={source.url}
              target={isExternalHref(source.url) ? "_blank" : undefined}
              rel={isExternalHref(source.url) ? "noreferrer" : undefined}
              className={cn(
                "group/source flex items-center gap-2 rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-black/[0.03] hover:text-[var(--color-text)]",
                isCompact ? "px-1 py-1" : "px-1.5 py-1.5",
              )}
            >
              {isCompact ? (
                <SourceFavicon source={source} />
              ) : (
                <span className="w-7 shrink-0 text-[10px] font-medium text-[var(--color-text-tertiary)]">
                  {source.id ?? index + 1}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {isCompact ? getSiteName(source) : source.title}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[var(--color-text-tertiary)]">
                  {isCompact
                    ? source.title
                    : compactMeta([
                        getDomainLabel(source),
                        getSourceTypeLabel(source.sourceType),
                        getQualityLabel(source.qualityTier),
                      ])}
                </span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-colors group-hover/source:text-[var(--color-text-secondary)]" />
            </a>
          ))
        ) : (
          <p className="rounded-md px-1.5 py-1.5 text-[var(--color-text-tertiary)]">
            {isRunning ? "正在读取外部来源。" : emptyText}
          </p>
        )}
        {sources.length > visibleSources.length ? (
          <p className="px-1.5 pt-1 text-[10px] text-[var(--color-text-tertiary)]">
            另有 {sources.length - visibleSources.length} 个来源
          </p>
        ) : null}
      </div>
    </details>
  );
}

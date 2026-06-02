/**
 * SearchResults - 搜索结果展示组件
 */

"use client";

import { Check, ChevronDown, ExternalLink, FileText, MessageSquare, Search } from "lucide-react";
import type {
  SearchNotesOutput,
  SearchResultItem,
  WebSearchOutput,
  WebSearchResult,
} from "./types";

interface SearchResultsProps {
  output: SearchNotesOutput | WebSearchOutput;
  type: "searchNotes" | "webSearch";
  defaultOpen?: boolean;
}

function isWebSearchResult(result: SearchResultItem | WebSearchResult): result is WebSearchResult {
  return "url" in result && !("sourceId" in result);
}

function getHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

export function SearchResults({ output, type, defaultOpen = false }: SearchResultsProps) {
  if (!output.success || output.results.length === 0) {
    return (
      <div className="mt-2 rounded-2xl bg-[var(--color-panel-soft)] p-3">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          未找到相关{type === "webSearch" ? "网页" : "笔记"}
        </p>
      </div>
    );
  }

  return (
    <details
      className="group mt-2 overflow-hidden rounded-[20px] border border-black/[0.06] bg-[#fbfaf6] shadow-[0_14px_40px_rgba(20,18,14,0.04)]"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-950 text-white">
          {defaultOpen ? (
            <Search className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-[var(--color-text)]">
            {type === "webSearch"
              ? `已检索 ${output.results.length} 个来源`
              : `已检索 ${output.results.length} 条笔记`}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-[var(--color-text-tertiary)]">
            {type === "webSearch"
              ? output.results
                  .slice(0, 2)
                  .map((result) => getHostLabel((result as WebSearchResult).url))
                  .join(" / ")
              : output.query}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-2 border-black/[0.05] border-t px-3.5 pb-3.5 pt-3">
        {output.results.map((result, index) => {
          const isWeb = isWebSearchResult(result);

          return (
            <a
              key={isWeb ? result.url : result.id || index}
              href={isWeb ? result.url : `/editor/${result.sourceId}`}
              target={isWeb ? "_blank" : undefined}
              rel={isWeb ? "noopener noreferrer" : undefined}
              className="block rounded-2xl bg-white/72 p-3 ring-1 ring-black/[0.04] transition-colors hover:bg-white"
            >
              <div className="flex items-start gap-2">
                {isWeb ? (
                  <ExternalLink className="w-4 h-4 mt-0.5 text-[var(--color-text-muted)]" />
                ) : result.sourceType === "note" ? (
                  <FileText className="w-4 h-4 mt-0.5 text-[var(--color-text-muted)]" />
                ) : (
                  <MessageSquare className="w-4 h-4 mt-0.5 text-[var(--color-text-muted)]" />
                )}

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-[var(--color-text)] truncate">
                    {result.title}
                  </h4>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1 line-clamp-2">
                    {isWeb ? result.snippet : result.content}
                  </p>
                  {!isWeb && "relevance" in result && (
                    <div className="mt-2">
                      <span className="rounded-md bg-[var(--color-panel-soft)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        {result.relevance}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </details>
  );
}

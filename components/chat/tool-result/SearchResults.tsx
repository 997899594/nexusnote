/**
 * SearchResults - 搜索结果展示组件
 */

"use client";

import { Search } from "lucide-react";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
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

function getHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

function getNoteHref(result: SearchResultItem): string {
  return result.sourceType === "conversation"
    ? `/chat/${result.sourceId}`
    : `/editor/${result.sourceId}`;
}

export function SearchResults({ output, type, defaultOpen = false }: SearchResultsProps) {
  if (!output.success || output.results.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 border-black/[0.06] border-y py-2 text-xs text-[var(--color-text-tertiary)]">
        <Search className="h-3.5 w-3.5" />
        <p>未找到相关{type === "webSearch" ? "网页" : "笔记"}</p>
      </div>
    );
  }

  if (type === "webSearch") {
    const results = output.results as WebSearchResult[];
    return (
      <ResearchSourceStrip
        sources={results.map((result) => ({
          title: result.title,
          url: result.url,
          domain: getHostLabel(result.url),
          snippet: result.snippet,
        }))}
        label={`网页 ${results.length}`}
        meta={results.slice(0, 2).map((result) => getHostLabel(result.url))}
        defaultOpen={defaultOpen}
        className="mt-2"
      />
    );
  }

  const results = output.results as SearchResultItem[];
  return (
    <ResearchSourceStrip
      sources={results.map((result, index) => ({
        id: `N${index + 1}`,
        title: result.title,
        url: getNoteHref(result),
        domain: result.sourceType === "conversation" ? "对话" : "笔记",
        sourceType: result.sourceType,
        snippet: result.content,
      }))}
      label={`笔记 ${results.length}`}
      meta={[output.query]}
      defaultOpen={defaultOpen}
      className="mt-2"
    />
  );
}

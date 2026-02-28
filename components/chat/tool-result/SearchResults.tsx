/**
 * SearchResults - 搜索结果展示组件
 */

"use client";

import { ExternalLink, FileText, MessageSquare, Search } from "lucide-react";
import type {
  SearchNotesOutput,
  SearchResultItem,
  WebSearchOutput,
  WebSearchResult,
} from "./types";

interface SearchResultsProps {
  output: SearchNotesOutput | WebSearchOutput;
  type: "searchNotes" | "webSearch";
}

function isWebSearchResult(result: SearchResultItem | WebSearchResult): result is WebSearchResult {
  return "url" in result && !("sourceId" in result);
}

export function SearchResults({ output, type }: SearchResultsProps) {
  if (!output.success || output.results.length === 0) {
    return (
      <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
        <p className="text-sm text-zinc-500">未找到相关{type === "webSearch" ? "网页" : "笔记"}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Search className="w-4 h-4" />
        <span>
          找到 {output.results.length} 个相关
          {type === "webSearch" ? "网页" : "结果"}
        </span>
      </div>

      <div className="space-y-2">
        {output.results.map((result, index) => {
          const isWeb = isWebSearchResult(result);

          return (
            <a
              key={isWeb ? result.url : result.id || index}
              href={isWeb ? result.url : `/notes/${result.sourceId}`}
              target={isWeb ? "_blank" : undefined}
              rel={isWeb ? "noopener noreferrer" : undefined}
              className="block p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start gap-2">
                {isWeb ? (
                  <ExternalLink className="w-4 h-4 mt-0.5 text-zinc-400" />
                ) : result.sourceType === "document" ? (
                  <FileText className="w-4 h-4 mt-0.5 text-zinc-400" />
                ) : (
                  <MessageSquare className="w-4 h-4 mt-0.5 text-zinc-400" />
                )}

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {result.title}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {isWeb ? result.snippet : result.content}
                  </p>
                  {!isWeb && "relevance" in result && (
                    <div className="mt-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        相关度: {result.relevance}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Web Search Result UI Component
 *
 * 渲染 Tavily searchWeb 工具的搜索结果
 */
"use client";

import { motion } from "framer-motion";
import { Calendar, ExternalLink, Globe, Search } from "lucide-react";

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
}

interface WebSearchResultProps {
  query: string;
  answer?: string;
  results: SearchResult[];
  searchDepth: "basic" | "advanced";
}

export function WebSearchResult({ query, answer, results, searchDepth }: WebSearchResultProps) {
  return (
    <div className="my-3 p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 rounded-2xl border border-sky-200/50 dark:border-sky-800/50">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
          <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Search className="w-3 h-3 text-muted-foreground" />
            <h3 className="font-semibold text-sm">{query}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            找到 {results.length} 个结果 · {searchDepth === "advanced" ? "深度搜索" : "快速搜索"}
          </p>
        </div>
      </div>

      {/* AI Answer Summary */}
      {answer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 p-3 bg-sky-100/50 dark:bg-sky-900/20 rounded-xl border border-sky-200 dark:border-sky-800"
        >
          <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider mb-1">
            AI 摘要
          </p>
          <p className="text-sm leading-relaxed">{answer}</p>
        </motion.div>
      )}

      {/* Search Results */}
      <div className="space-y-2">
        {results.map((result, idx) => (
          <motion.a
            key={idx}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="block p-3 bg-white dark:bg-neutral-800 rounded-xl hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-medium group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                {result.title}
              </h4>
              <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{result.content}</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {new URL(result.url).hostname}
              </span>
              {result.publishedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(result.publishedDate).toLocaleDateString("zh-CN")}
                </span>
              )}
              {result.score && (
                <span className="ml-auto px-1.5 py-0.5 bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded">
                  {Math.round(result.score * 100)}%
                </span>
              )}
            </div>
          </motion.a>
        ))}
      </div>

      {/* Footer Tip */}
      <p className="text-[10px] text-center text-muted-foreground mt-3">💡 点击结果可查看原文</p>
    </div>
  );
}

"use client";

import { ExternalLink, FileText, Search } from "lucide-react";
import Link from "next/link";

interface SearchResult {
  title: string;
  content: string;
  documentId: string;
  relevance: number;
}

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
}

export function SearchResults({ query, results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="bg-gray-50 border rounded-xl p-4 my-2">
        <div className="flex items-center gap-2 text-gray-500">
          <Search className="w-4 h-4" />
          <span>没有找到与 "{query}" 相关的笔记</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-blue-600" />
        <span className="font-medium text-gray-900">找到 {results.length} 条相关笔记</span>
      </div>

      <div className="space-y-2">
        {results.map((result, i) => (
          <Link
            key={result.documentId + i}
            href={`/editor/${result.documentId}`}
            className="block bg-white rounded-lg p-3 border border-blue-100 hover:border-blue-300 transition group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="font-medium text-gray-900 truncate">{result.title}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                  {result.relevance}%
                </span>
                <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.content}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

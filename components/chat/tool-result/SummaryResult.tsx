/**
 * SummaryResult - 摘要结果展示组件
 */

"use client";

import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useState } from "react";
import type { SummaryOutput } from "./types";

interface SummaryResultProps {
  output: SummaryOutput;
}

export function SummaryResult({ output }: SummaryResultProps) {
  const [expanded, setExpanded] = useState(false);

  if (!output.success || !output.summary) {
    return (
      <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600">{output.error || "摘要生成失败"}</p>
      </div>
    );
  }

  const { summary } = output;
  const styleLabels = {
    bullet_points: "要点列表",
    paragraph: "段落",
    key_takeaways: "关键要点",
  };

  return (
    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          摘要 ({styleLabels[summary.style]})
        </span>
      </div>

      <div className={`text-sm text-zinc-700 dark:text-zinc-300 ${!expanded && "line-clamp-3"}`}>
        {summary.content}
      </div>

      {summary.content.length > 200 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              展开更多
            </>
          )}
        </button>
      )}
    </div>
  );
}

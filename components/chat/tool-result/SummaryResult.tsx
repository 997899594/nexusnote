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
      <div className="mt-2 rounded-2xl bg-[var(--color-panel-soft)] p-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {output.error || "摘要生成失败"}
        </p>
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
    <div className="mt-2 rounded-2xl bg-[var(--color-panel-soft)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-[var(--color-text)]" />
        <span className="text-sm font-medium text-[var(--color-text)]">
          摘要 ({styleLabels[summary.style]})
        </span>
      </div>

      <div className={`text-sm text-[var(--color-text-secondary)] ${!expanded && "line-clamp-3"}`}>
        {summary.content}
      </div>

      {summary.content.length > 200 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text)] hover:text-[var(--color-text-secondary)]"
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

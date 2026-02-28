/**
 * NoteLink - 笔记跳转链接组件
 */

"use client";

import { ExternalLink, FileText } from "lucide-react";
import type { CreateNoteOutput, GetNoteOutput } from "./types";

interface NoteLinkProps {
  output: CreateNoteOutput | GetNoteOutput;
  type: "create" | "view";
}

export function NoteLink({ output, type }: NoteLinkProps) {
  if (!output.success) {
    return (
      <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600">{output.error}</p>
      </div>
    );
  }

  const href = type === "create" ? `/notes/${output.id}` : `/notes/${output.id}`;

  return (
    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-800 dark:text-green-200">
          笔记 {type === "create" ? "创建" : "获取"} 成功
        </span>
      </div>
      <a
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
      >
        <ExternalLink className="w-3 h-3" />
        {output.title || "查看笔记"}
      </a>
    </div>
  );
}

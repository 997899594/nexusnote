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
      <div className="mt-2 rounded-2xl bg-[#f6f7f9] p-3">
        <p className="text-sm text-zinc-600">{output.error}</p>
      </div>
    );
  }

  const href = `/editor/${output.id}`;

  return (
    <div className="mt-2 rounded-2xl bg-[#f6f7f9] p-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#111827]" />
        <span className="text-sm text-[#111827]">
          笔记 {type === "create" ? "创建" : "获取"} 成功
        </span>
      </div>
      <a
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[#111827]"
      >
        <ExternalLink className="w-3 h-3" />
        {output.title || "查看笔记"}
      </a>
    </div>
  );
}

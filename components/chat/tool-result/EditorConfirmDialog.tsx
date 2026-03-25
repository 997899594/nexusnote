/**
 * EditorConfirmDialog - 编辑器操作确认弹窗
 *
 * 用于 editDocument, batchEdit, draftContent 需要用户确认的操作
 */

"use client";

import { Check, Edit3, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { BatchEditOutput, DraftContentOutput, EditDocumentOutput } from "./types";

interface EditorConfirmDialogProps {
  output: EditDocumentOutput | BatchEditOutput | DraftContentOutput;
  toolName: string;
}

function isDraftContent(
  output: EditDocumentOutput | BatchEditOutput | DraftContentOutput,
): output is DraftContentOutput {
  return "content" in output && !("edits" in output);
}

function isBatchEdit(
  output: EditDocumentOutput | BatchEditOutput | DraftContentOutput,
): output is BatchEditOutput {
  return "edits" in output && Array.isArray(output.edits) && output.edits.length > 1;
}

export function EditorConfirmDialog({ output, toolName }: EditorConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (!output.requiresConfirmation) {
    return null;
  }

  const handleConfirm = async () => {
    setIsConfirming(true);

    try {
      const response = await fetch("/api/chat/execute-editor-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName,
          explanation: output.explanation,
          edits: "edits" in output ? output.edits : undefined,
          content: isDraftContent(output) ? output.content : undefined,
          targetId: "targetId" in output ? output.targetId : undefined,
          newContent: "newContent" in output ? output.newContent : undefined,
        }),
      });

      if (response.ok) {
        setIsConfirmed(true);
      }
    } catch (error) {
      console.error("Failed to execute editor action:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="mt-2 rounded-2xl bg-[#f6f7f9] p-3">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-[#111827]" />
          <span className="text-sm text-zinc-700">操作已执行</span>
        </div>
      </div>
    );
  }

  const isDraft = isDraftContent(output);
  const isBatch = isBatchEdit(output);

  return (
    <div className="mt-2 rounded-2xl bg-[#f6f7f9] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Edit3 className="h-4 w-4 text-[#111827]" />
        <span className="text-sm font-medium text-[#111827]">
          {isDraft ? "确认插入内容" : isBatch ? "确认批量修改" : "确认编辑"}
        </span>
      </div>

      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{output.explanation}</p>

      {isDraft && output.content && (
        <div className="mb-3 max-h-32 overflow-y-auto rounded-xl bg-white p-2 text-xs text-[var(--color-text-secondary)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)]">
          {output.content.slice(0, 500)}
          {output.content.length > 500 && "..."}
        </div>
      )}

      {isBatch && output.edits && (
        <div className="mb-3 space-y-1">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {output.edits.length} 个修改:
          </p>
          {output.edits.slice(0, 3).map((edit, i) => (
            <div
              key={`${edit.targetId}-${i}`}
              className="rounded-lg bg-white p-1 text-xs shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)]"
            >
              {edit.action}: {edit.targetId}
            </div>
          ))}
          {output.edits.length > 3 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              ...还有 {output.edits.length - 3} 个修改
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#111827] px-3 py-1.5 text-xs text-white transition-colors disabled:opacity-50"
        >
          {isConfirming ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          确认
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs text-[var(--color-text-secondary)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] transition-colors hover:bg-[#f8fafc]"
        >
          <X className="w-3 h-3" />
          取消
        </button>
      </div>
    </div>
  );
}

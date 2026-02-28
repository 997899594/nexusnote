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
      <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">操作已执行</span>
        </div>
      </div>
    );
  }

  const isDraft = isDraftContent(output);
  const isBatch = isBatchEdit(output);

  return (
    <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <Edit3 className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {isDraft ? "确认插入内容" : isBatch ? "确认批量修改" : "确认编辑"}
        </span>
      </div>

      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">{output.explanation}</p>

      {isDraft && output.content && (
        <div className="mb-3 p-2 bg-white dark:bg-zinc-900 rounded text-xs text-zinc-600 dark:text-zinc-400 max-h-32 overflow-y-auto">
          {output.content.slice(0, 500)}
          {output.content.length > 500 && "..."}
        </div>
      )}

      {isBatch && output.edits && (
        <div className="mb-3 space-y-1">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {output.edits.length} 个修改:
          </p>
          {output.edits.slice(0, 3).map((edit, i) => (
            <div
              key={`${edit.targetId}-${i}`}
              className="text-xs p-1 bg-white dark:bg-zinc-900 rounded"
            >
              {edit.action}: {edit.targetId}
            </div>
          ))}
          {output.edits.length > 3 && (
            <p className="text-xs text-zinc-500">...还有 {output.edits.length - 3} 个修改</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isConfirming}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition-colors disabled:opacity-50"
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
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs rounded transition-colors"
        >
          <X className="w-3 h-3" />
          取消
        </button>
      </div>
    </div>
  );
}

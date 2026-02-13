"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useState } from "react";

interface EditConfirmCardProps {
  action: string;
  targetId: string;
  newContent?: string;
  originalContent?: string;
  explanation: string;
  onApply: () => void;
  onDiscard: () => void;
  isPending?: boolean;
}

const actionLabels: Record<string, string> = {
  replace: "替换",
  replace_all: "全文替换",
  insert_after: "在后插入",
  insert_before: "在前插入",
  delete: "删除",
};

const actionColors: Record<string, string> = {
  replace: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  replace_all: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  insert_after: "bg-green-500/10 text-green-500 border-green-500/20",
  insert_before: "bg-green-500/10 text-green-500 border-green-500/20",
  delete: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function EditConfirmCard({
  action,
  targetId,
  newContent,
  originalContent,
  explanation,
  onApply,
  onDiscard,
  isPending = false,
}: EditConfirmCardProps) {
  const [showDiff, setShowDiff] = useState(true);
  const isDelete = action === "delete";
  const isReplaceAll = action === "replace_all";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 shadow-lg"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${actionColors[action] || "bg-muted"}`}
          >
            {actionLabels[action] || action}
          </span>
          {!isReplaceAll && (
            <span className="text-xs text-muted-foreground font-mono">{targetId}</span>
          )}
        </div>
        {!isDelete && newContent && (
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            title={showDiff ? "隐藏对比" : "显示对比"}
          >
            {showDiff ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Content Preview */}
      <div className="p-4 space-y-3 max-h-[200px] overflow-auto">
        <AnimatePresence mode="wait">
          {/* Delete Action */}
          {isDelete && originalContent && (
            <motion.div
              key="delete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl"
            >
              <div className="text-[10px] font-bold uppercase text-red-500 mb-1">将删除</div>
              <div className="text-sm text-red-700 dark:text-red-300 line-through">
                {originalContent.slice(0, 200)}
                {originalContent.length > 200 && "..."}
              </div>
            </motion.div>
          )}

          {/* Replace/Insert with Diff */}
          {showDiff && !isDelete && (
            <motion.div
              key="diff"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {originalContent && !isReplaceAll && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-red-500 mb-1">原内容</div>
                  <div className="text-sm text-red-700 dark:text-red-300 line-through">
                    {originalContent.slice(0, 150)}
                    {originalContent.length > 150 && "..."}
                  </div>
                </div>
              )}
              {newContent && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-green-500 mb-1">
                    {isReplaceAll ? "新文档" : "新内容"}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    {newContent.slice(0, 300)}
                    {newContent.length > 300 && (
                      <span className="text-muted-foreground"> ...({newContent.length} 字符)</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explanation */}
        {explanation && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-black/5 dark:border-white/5">
            {explanation}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-black/5 dark:border-white/5 bg-muted/20 flex items-center justify-end gap-2">
        <button
          onClick={onDiscard}
          disabled={isPending}
          className="px-4 py-2 text-xs font-medium border border-black/10 dark:border-white/10 rounded-xl hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          放弃
        </button>
        <button
          onClick={onApply}
          disabled={isPending}
          className="px-4 py-2 text-xs font-bold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-1.5 shadow-lg shadow-violet-900/20 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          应用编辑
        </button>
      </div>
    </motion.div>
  );
}

/**
 * 编辑进行中的提示
 */
export function EditThinking({ action }: { action?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-violet-500/5 border border-violet-500/10"
    >
      <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
      <span className="text-xs text-violet-500 font-medium">
        正在分析编辑意图{action ? `（${actionLabels[action] || action}）` : ""}...
      </span>
    </motion.div>
  );
}

export default EditConfirmCard;

"use client";

/**
 * useEditorToolGuard — AI 编辑操作沙箱
 *
 * 在任何 AI 编辑操作前自动创建快照（trigger: ai_edit），
 * 提供一键回滚到 AI 编辑前状态的能力。
 *
 * 用法：
 *   const guard = useEditorToolGuard(ydoc, documentId);
 *   guard.runWithGuard("improve", selectedText);
 *   guard.undoLastAIEdit(); // 一键回滚
 */

import { useCallback, useRef } from "react";
import type * as Y from "yjs";
import { snapshotStore } from "../stores/snapshot-store";
import { type AIAction, useInlineAI } from "./useInlineAI";

interface GuardState {
  /** 最近一次 AI 编辑前的快照 ID */
  lastPreEditSnapshotId: string | null;
  /** 是否正在执行 AI 操作 */
  pending: boolean;
}

export function useEditorToolGuard(ydoc: Y.Doc | null, documentId: string | null) {
  const inlineAI = useInlineAI();
  const stateRef = useRef<GuardState>({
    lastPreEditSnapshotId: null,
    pending: false,
  });

  /**
   * 在 AI 编辑前创建快照，然后执行 AI 操作
   */
  const runWithGuard = useCallback(
    async (action: AIAction, selection: string) => {
      if (!ydoc || !documentId) return;
      if (stateRef.current.pending) return;

      stateRef.current.pending = true;

      try {
        // AI 编辑前创建快照
        const snapshot = await snapshotStore.createSnapshot(
          documentId,
          ydoc,
          "ai_edit",
          `AI: ${action}`,
        );
        if (snapshot) {
          stateRef.current.lastPreEditSnapshotId = snapshot.id;
        }

        // 执行 AI 操作
        await inlineAI.runAction(action, selection);
      } finally {
        stateRef.current.pending = false;
      }
    },
    [ydoc, documentId, inlineAI],
  );

  /**
   * 回滚最近一次 AI 编辑
   */
  const undoLastAIEdit = useCallback(async () => {
    const snapshotId = stateRef.current.lastPreEditSnapshotId;
    if (!snapshotId || !ydoc) return false;

    const restored = await snapshotStore.restoreSnapshot(snapshotId, ydoc);
    if (restored) {
      stateRef.current.lastPreEditSnapshotId = null;
    }
    return restored;
  }, [ydoc]);

  return {
    /** 带快照保护的 AI 操作 */
    runWithGuard,
    /** 回滚最近一次 AI 编辑 */
    undoLastAIEdit,
    /** 是否有可回滚的 AI 编辑 */
    canUndo: stateRef.current.lastPreEditSnapshotId !== null,
    /** AI 操作状态（透传） */
    completion: inlineAI.completion,
    isLoading: inlineAI.isLoading,
    error: inlineAI.error,
    stop: inlineAI.stop,
    reset: inlineAI.reset,
  };
}

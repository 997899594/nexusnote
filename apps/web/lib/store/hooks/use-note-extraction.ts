/**
 * Note Extraction Hooks
 *
 * 基于 Jotai 的笔记提取状态管理
 * 替代 NoteExtractionContext
 */

"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import useSWR from "swr";
import {
  optimisticNotesAtom,
  topicsAtom,
  noteExtractionLoadingAtom,
  isKnowledgeSidebarOpenAtom,
  hasProcessingNotesAtom,
} from "../atoms/note-extraction";
import { userIdAtom } from "../atoms/auth";
import type { ExtractedNote, Topic, NoteSource } from "../atoms/note-extraction";
import { extractNoteAction } from "@/app/actions/ai";
import { getNoteTopicsAction } from "@/app/actions/note";
import { useToast } from "./use-toast";

// ============================================
// SWR Fetcher
// ============================================
const actionFetcher = async ([_key, ...args]: unknown[]) => {
  const result = await getNoteTopicsAction(args[0] as string);
  if (!result.success) throw new Error(result.error);
  return result.data;
};

// ============================================
// Hooks
// ============================================

/**
 * 笔记提取主 Hook
 *
 * 替代 NoteExtractionContext 的 useNoteExtraction
 */
export function useNoteExtraction() {
  // State atoms
  const [optimisticNotes, setOptimisticNotes] = useAtom(optimisticNotesAtom);
  const [topics, setTopics] = useAtom(topicsAtom);
  const [isLoading, setIsLoading] = useAtom(noteExtractionLoadingAtom);
  const [userId, setUserId] = useAtom(userIdAtom);
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(isKnowledgeSidebarOpenAtom);

  // Toast hook
  const toast = useToast();

  // Refs (无法放在 atom 中，保留在 hook 里)
  const knowledgeTabRef = useRef<HTMLButtonElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);

  // Smart polling: faster when processing, slower when idle
  const hasProcessingNotes = useAtomValue(hasProcessingNotesAtom);

  // Fetch topics with SWR
  const { data: topicsData, isLoading: swrLoading } = useSWR(
    userId ? ["note-topics", userId] : null,
    actionFetcher,
    {
      refreshInterval: hasProcessingNotes ? 3000 : 30000,
      revalidateOnFocus: true,
      onSuccess: (data) => {
        setTopics((data?.topics ?? []) as Topic[]);
      },
    },
  );

  // Sync loading state
  useEffect(() => {
    setIsLoading(swrLoading);
  }, [swrLoading, setIsLoading]);

  /**
   * Extract a note: trigger flying animation and send to backend
   */
  const extractNote = useCallback(
    async (content: string, rect: DOMRect, source: NoteSource) => {
      if (!userId) {
        console.warn("[NoteExtraction] No userId set, cannot extract");
        return;
      }

      const tempId = crypto.randomUUID();

      // Step 1: Optimistic update - immediately show flying status
      setOptimisticNotes((prev) => [
        ...prev,
        {
          id: tempId,
          content: content.slice(0, 200),
          status: "flying",
        },
      ]);

      // Step 2: After animation completes (600ms), switch to processing
      setTimeout(() => {
        setOptimisticNotes((prev) =>
          prev.map((n) =>
            n.id === tempId ? { ...n, status: "processing" } : n,
          ),
        );
      }, 600);

      // Step 3: Send request to backend with error rollback
      try {
        const { noteId } = await extractNoteAction({
          content,
          sourceType: source.sourceType,
          sourceDocumentId: source.documentId,
          sourceChapterId: source.chapterId,
          sourcePosition: JSON.stringify(source.position),
        });

        console.log(`[NoteExtraction] Created note: ${noteId}`);

        // Show success toast
        toast.success("笔记已提取到知识库");

        // Step 4: Remove from optimistic notes after a delay
        setTimeout(() => {
          setOptimisticNotes((prev) => prev.filter((n) => n.id !== tempId));
        }, 5000);
      } catch (err) {
        console.error("[NoteExtraction] Failed to extract:", err);
        // Rollback: remove the optimistic note
        setOptimisticNotes((prev) => prev.filter((n) => n.id !== tempId));
        // Show error toast
        toast.error("提取笔记失败，请稍后重试");
      }
    },
    [userId, setOptimisticNotes, toast],
  );

  /**
   * Clear a flying note (called when animation completes)
   */
  const clearFlyingNote = useCallback((noteId: string) => {
    setOptimisticNotes((prev) =>
      prev.map((n) =>
        n.id === noteId && n.status === "flying"
          ? { ...n, status: "processing" }
          : n,
      ),
    );
  }, [setOptimisticNotes]);

  return {
    // Data
    pendingNotes: optimisticNotes,
    topics,
    isLoading,

    // Actions
    extractNote,
    clearFlyingNote,

    // Refs
    knowledgeTabRef,
    sidebarToggleRef,

    // UI state
    isSidebarOpen,
    setIsSidebarOpen,

    // User
    userId,
    setUserId,
  };
}

/**
 * 可选版本的 Hook - 不抛出错误
 */
export function useNoteExtractionOptional() {
  try {
    return useNoteExtraction();
  } catch {
    return null;
  }
}

// ============================================
// Individual Hooks (如果只需要部分状态)
// ============================================

/**
 * 仅获取笔记提取状态
 */
export function usePendingNotes() {
  return useAtomValue(optimisticNotesAtom);
}

/**
 * 仅获取主题列表
 */
export function useTopics() {
  const [topics, setTopics] = useAtom(topicsAtom);
  const isLoading = useAtomValue(noteExtractionLoadingAtom);

  // Fetch topics
  const userId = useAtomValue(userIdAtom);
  const hasProcessingNotes = useAtomValue(hasProcessingNotesAtom);

  useSWR(
    userId ? ["note-topics", userId] : null,
    actionFetcher,
    {
      refreshInterval: hasProcessingNotes ? 3000 : 30000,
      revalidateOnFocus: true,
      onSuccess: (data) => {
        setTopics((data?.topics ?? []) as Topic[]);
      },
    },
  );

  return { topics, isLoading };
}

/**
 * 仅获取笔记提取操作函数
 */
export function useNoteExtractionActions() {
  const setOptimisticNotes = useSetAtom(optimisticNotesAtom);
  const userId = useAtomValue(userIdAtom);

  const extractNote = useCallback(
    async (content: string, source: NoteSource) => {
      if (!userId) {
        console.warn("[NoteExtraction] No userId set, cannot extract");
        return;
      }

      const tempId = crypto.randomUUID();
      setOptimisticNotes((prev) => [
        ...prev,
        {
          id: tempId,
          content: content.slice(0, 200),
          status: "processing",
        },
      ]);

      try {
        const { noteId } = await extractNoteAction({
          content,
          sourceType: source.sourceType,
          sourceDocumentId: source.documentId,
          sourceChapterId: source.chapterId,
          sourcePosition: JSON.stringify(source.position),
        });

        // Remove from optimistic notes after processing
        setTimeout(() => {
          setOptimisticNotes((prev) => prev.filter((n) => n.id !== tempId));
        }, 5000);

        return noteId;
      } catch (err) {
        console.error("[NoteExtraction] Failed to extract:", err);
        setOptimisticNotes((prev) => prev.filter((n) => n.id !== tempId));
        throw err;
      }
    },
    [userId, setOptimisticNotes],
  );

  return { extractNote };
}

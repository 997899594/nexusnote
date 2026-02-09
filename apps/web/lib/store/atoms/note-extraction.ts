/**
 * Note Extraction State
 *
 * 笔记提取和知识管理相关的全局状态
 * 从 NoteExtractionContext 迁移而来
 */

import { atom } from "jotai";
import { userIdAtom } from "./auth";

// ============================================
// Types
// ============================================

export interface ExtractedNote {
  id: string;
  content: string;
  status: "flying" | "processing" | "classified";
  topicId?: string;
  topicName?: string;
}

export interface Topic {
  id: string;
  name: string;
  noteCount: number;
  lastActiveAt: string | null;
  recentNotes?: Array<{ id: string; content: string }>;
}

export interface NoteSource {
  sourceType: "document" | "learning";
  documentId?: string;
  chapterId?: string;
  position: { from: number; to: number };
}

// ============================================
// Internal Atoms
// ============================================

// 引用 auth 模块的 userIdAtom，不重复导出避免冲突

/**
 * 乐观更新的笔记列表（飞行中、处理中）
 */
export const optimisticNotesAtom = atom<ExtractedNote[]>([]);

/**
 * 知识主题列表
 */
export const topicsAtom = atom<Topic[]>([]);

/**
 * 笔记提取加载状态
 */
export const noteExtractionLoadingAtom = atom(false);

/**
 * 知识侧边栏是否打开
 */
export const isKnowledgeSidebarOpenAtom = atom(true);

/**
 * 是否有正在处理的笔记（用于智能轮询）
 */
export const hasProcessingNotesAtom = atom((get) => {
  return get(optimisticNotesAtom).some((n) => n.status === "processing");
});

/**
 * UI State
 *
 * 全局 UI 状态：侧边栏、模态框、通知等
 */

import { clientEnv } from "@nexusnote/config";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ============================================
// AI Preferences
// ============================================

/**
 * 是否启用 AI 联网搜索
 * 优先级：用户设置 > 环境变量默认值
 */
export const enableWebSearchAtom = atomWithStorage(
  "nexusnote-enable-web-search",
  clientEnv.NEXT_PUBLIC_AI_ENABLE_WEB_SEARCH,
);

// ============================================
// Sidebar
// ============================================

/**
 * 主侧边栏是否展开
 */
export const isMainSidebarOpenAtom = atom(true);

/**
 * 知识面板是否展开
 */
export const isKnowledgePanelOpenAtom = atom(false);

/**
 * AI 聊天面板是否展开
 */
export const isAIChatOpenAtom = atom(false);

// ============================================
// Modals
// ============================================

/**
 * 当前打开的模态框
 */
export const activeModalAtom = atom<string | null>(null);

/**
 * 模态框参数
 */
export const modalParamsAtom = atom<Record<string, unknown> | null>(null);

// ============================================
// Notifications / Toasts
// ============================================

export interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  duration?: number;
}

/**
 * 当前显示的通知列表
 */
export const toastsAtom = atom<Toast[]>([]);

// ============================================
// Editor UI
// ============================================

/**
 * 编辑器是否全屏
 */
export const isEditorFullscreenAtom = atom(false);

/**
 * 是否显示编辑器帮助
 */
export const showEditorHelpAtom = atom(false);

/**
 * 是否显示幽灵助手
 */
export const showGhostAssistantAtom = atom(true);

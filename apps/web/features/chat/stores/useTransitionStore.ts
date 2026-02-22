/**
 * Transition Store - 纯动画状态管理
 *
 * 职责：
 * - 管理 TransitionOverlay 的动画状态
 * - 存储 originRect（输入框位置）供收缩动画使用
 * - 触发路由跳转（通过传入的 targetUrl）
 *
 * 不管理：
 * - pendingMessage（通过 URL query 传递）
 * - sessionId（由 /chat page 创建后 replace URL）
 */

import { create } from "zustand";

export type TransitionPhase = "idle" | "expanding" | "collapsing";

interface TransitionStore {
  phase: TransitionPhase;
  originRect: DOMRect | null;
  targetUrl: string | null;

  /**
   * 开始展开动画：HeroInput → 全屏
   * @param rect - HeroInput 卡片的 getBoundingClientRect()
   * @param targetUrl - 目标路由（例如 /chat?q=消息）
   */
  startExpand: (rect: DOMRect, targetUrl: string) => void;

  /**
   * 开始收缩动画：全屏 → HeroInput → 返回首页
   * 如果没有 originRect（用户直接访问 /chat），使用屏幕中心 fallback
   */
  startCollapse: () => void;

  /**
   * 完成动画，重置状态
   */
  finish: () => void;
}

export const useTransitionStore = create<TransitionStore>((set) => ({
  phase: "idle",
  originRect: null,
  targetUrl: null,

  startExpand: (rect, targetUrl) =>
    set({
      phase: "expanding",
      originRect: rect,
      targetUrl,
    }),

  startCollapse: () =>
    set((state) => ({
      phase: "collapsing",
      // 保留 originRect（如果有），没有则 TransitionOverlay 会 fallback
      originRect: state.originRect,
    })),

  finish: () =>
    set({
      phase: "idle",
      targetUrl: null,
      // 保留 originRect，供下次 collapse 使用
    }),
}));

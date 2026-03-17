/**
 * Transition Store - 首页→聊天页过渡动画状态
 *
 * 职责：
 * - 管理 TransitionOverlay 的 expand/collapse 生命周期
 * - 存储 originRect（输入框位置）供 clip-path 动画使用
 * - 存储 pendingMessage 在 overlay 上显示用户输入的文字
 * - 协调 overlay 退场时机：等目标页面 markReady() 后才 fade out
 */

import { create } from "zustand";

export type TransitionPhase = "idle" | "expanding" | "expanded" | "collapsing";

interface TransitionStore {
  phase: TransitionPhase;
  originRect: DOMRect | null;
  targetUrl: string | null;
  pendingMessage: string | null;

  /** 开始展开动画：HeroInput → 全屏 */
  startExpand: (rect: DOMRect, targetUrl: string, message: string) => void;

  /** 目标页面已挂载并渲染完成，overlay 可以退场 */
  markReady: () => void;

  /** 开始收缩动画：全屏 → HeroInput → 返回首页 */
  startCollapse: () => void;

  /** 动画完成，重置状态 */
  finish: () => void;
}

export const useTransitionStore = create<TransitionStore>((set) => ({
  phase: "idle",
  originRect: null,
  targetUrl: null,
  pendingMessage: null,

  startExpand: (rect, targetUrl, message) =>
    set({
      phase: "expanding",
      originRect: rect,
      targetUrl,
      pendingMessage: message,
    }),

  markReady: () =>
    set((state) => {
      // Only transition from expanded → idle (trigger overlay exit)
      if (state.phase === "expanded") {
        return { phase: "idle", targetUrl: null, pendingMessage: null };
      }
      // If still expanding, the onAnimationComplete handler will check
      return state;
    }),

  startCollapse: () =>
    set((state) => ({
      phase: "collapsing",
      originRect: state.originRect,
      pendingMessage: null,
    })),

  finish: () =>
    set({
      phase: "idle",
      targetUrl: null,
      pendingMessage: null,
    }),
}));

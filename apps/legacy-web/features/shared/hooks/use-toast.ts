/**
 * Toast Notification Hook
 *
 * 全局通知系统
 */

"use client";

import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { type Toast, toastsAtom } from "../atoms/ui";

/**
 * Toast Hook - 显示全局通知
 */
export function useToast() {
  const setToasts = useSetAtom(toastsAtom);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info", duration = 4000) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, toast]);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    [setToasts],
  );

  const removeToast = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [setToasts],
  );

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, "success", duration),
    [addToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast(message, "error", duration),
    [addToast],
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast(message, "warning", duration),
    [addToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast(message, "info", duration),
    [addToast],
  );

  return {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

/**
 * 便捷函数 - 可以在任何地方使用（需要组件内调用）
 */
export function useToastMessage() {
  return useToast();
}

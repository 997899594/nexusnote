"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

interface InputProtectionOptions {
  /** 是否允许粘贴图片 */
  allowImages?: boolean;
  /** 错误消息 */
  errorMessage?: string;
}

export function useInputProtection(options: InputProtectionOptions = {}) {
  const { addToast } = useToast();
  const { allowImages = false, errorMessage = "当前 AI 不支持图片输入，请输入文字描述" } = options;

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (allowImages) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          addToast(errorMessage, "warning");
          return;
        }
      }
    },
    [allowImages, errorMessage, addToast],
  );

  return { handlePaste };
}

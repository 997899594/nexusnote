"use client";

import { motion } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import {
  type ClipboardEventHandler,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";
import { shouldSubmitOnEnter } from "@/components/common/keyboard";
import { cn } from "@/lib/utils";

export interface ChatComposerSubmitPayload {
  text: string;
  rawText: string;
}

interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (payload: ChatComposerSubmitPayload) => Promise<void> | void;
  placeholder?: string;
  isLoading?: boolean;
  inputDisabled?: boolean;
  submitDisabled?: boolean;
  rows?: number;
  autoResize?: boolean;
  maxHeightPx?: number;
  restoreOnError?: boolean;
  onSubmitError?: (error: unknown, payload: ChatComposerSubmitPayload) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  footer?: ReactNode;
  submitPlacement?: "inline" | "footer";
  className?: string;
  inputRowClassName?: string;
  footerClassName?: string;
  submitContainerClassName?: string;
  textareaClassName?: string;
  submitButtonClassName?: string;
  submitButtonActiveClassName?: string;
  submitButtonInactiveClassName?: string;
  submitIconClassName?: string;
  loadingIconClassName?: string;
  submitLabel?: ReactNode;
  submitAriaLabel?: string;
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  isLoading = false,
  inputDisabled = false,
  submitDisabled = false,
  rows = 1,
  autoResize = true,
  maxHeightPx = 120,
  restoreOnError = true,
  onSubmitError,
  onKeyDown,
  onPaste,
  footer,
  submitPlacement = "inline",
  className,
  inputRowClassName,
  footerClassName,
  submitContainerClassName,
  textareaClassName,
  submitButtonClassName,
  submitButtonActiveClassName = "ui-primary-button",
  submitButtonInactiveClassName = "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]",
  submitIconClassName = "h-4 w-4",
  loadingIconClassName = submitIconClassName,
  submitLabel,
  submitAriaLabel = "发送",
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedValue = value.trim();
  const canSubmit = Boolean(trimmedValue) && !isLoading && !inputDisabled && !submitDisabled;

  useLayoutEffect(() => {
    if (!autoResize) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
  });

  const submit = async () => {
    if (!canSubmit) {
      return;
    }

    const payload = {
      text: trimmedValue,
      rawText: value,
    };

    onValueChange("");

    try {
      await onSubmit(payload);
    } catch (error) {
      if (restoreOnError) {
        onValueChange(payload.rawText);
      }
      onSubmitError?.(error, payload);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (shouldSubmitOnEnter(event)) {
      event.preventDefault();
      void submit();
    }
  };

  const submitButton = (
    <motion.button
      type="button"
      whileHover={canSubmit ? { scale: 1.05 } : undefined}
      whileTap={canSubmit ? { scale: 0.95 } : undefined}
      onClick={() => void submit()}
      disabled={!canSubmit}
      className={cn(
        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
        canSubmit ? submitButtonActiveClassName : submitButtonInactiveClassName,
        submitButtonClassName,
      )}
      aria-label={submitAriaLabel}
    >
      {isLoading ? (
        <Loader2 className={cn("animate-spin", loadingIconClassName)} />
      ) : (
        <Send className={submitIconClassName} />
      )}
      {submitLabel}
    </motion.button>
  );

  return (
    <div className={cn("ui-input-shell rounded-[20px] p-2", className)}>
      <div className={cn("flex items-end gap-2", inputRowClassName)}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          rows={rows}
          disabled={inputDisabled}
          className={cn(
            "min-h-[24px] flex-1 resize-none border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-70",
            textareaClassName,
          )}
        />
        {submitPlacement === "inline" ? submitButton : null}
      </div>
      {footer ? <div className={footerClassName}>{footer}</div> : null}
      {submitPlacement === "footer" ? (
        <div className={submitContainerClassName}>{submitButton}</div>
      ) : null}
    </div>
  );
}

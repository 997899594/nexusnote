"use client";

import {
  getInterviewSessionModeDescription,
  getInterviewSessionModeLabel,
  INTERVIEW_SESSION_MODE_OPTIONS,
  type InterviewSessionMode,
} from "@/lib/ai/interview/session-mode";
import { cn } from "@/lib/utils";

interface InterviewModePickerProps {
  value: InterviewSessionMode;
  onChange: (mode: InterviewSessionMode) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function InterviewModePicker({
  value,
  onChange,
  disabled = false,
  compact = false,
  className,
}: InterviewModePickerProps) {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2",
        className,
      )}
    >
      {INTERVIEW_SESSION_MODE_OPTIONS.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "rounded-2xl border text-left transition-all",
              compact ? "px-3 py-2.5" : "px-4 py-3.5",
              isActive
                ? "ui-primary-button border-black/10"
                : "ui-control-surface text-[var(--color-text)] hover:border-black/14",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "font-medium",
                  compact ? "text-sm" : "text-[0.95rem]",
                  isActive ? "text-white" : "text-[var(--color-text)]",
                )}
              >
                {getInterviewSessionModeLabel(option.value)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.08em]",
                  isActive
                    ? "bg-white/14 text-white/80"
                    : "bg-[var(--color-active)] text-[var(--color-text-tertiary)]",
                )}
              >
                {option.value === "structured" ? "代码主导" : "自由对话"}
              </span>
            </div>
            {!compact && (
              <p
                className={cn(
                  "mt-1.5 text-xs leading-5",
                  isActive ? "text-white/72" : "text-[var(--color-text-muted)]",
                )}
              >
                {getInterviewSessionModeDescription(option.value)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

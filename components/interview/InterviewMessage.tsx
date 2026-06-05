"use client";

import { motion } from "framer-motion";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { InterviewOptions, type Option } from "@/components/interview/InterviewOptions";
import { InterviewResearchActivity } from "@/components/interview/InterviewResearchActivity";
import type { InterviewResearchEvent } from "@/lib/ai/interview/research-events";
import type { ResearchEvidenceSnapshot } from "@/lib/ai/research/evidence-snapshot";
import { cn } from "@/lib/utils";

export interface InterviewMessageData {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "question" | "outline";
  outlineComplete?: boolean;
  options?: Option[];
  researchEvidence?: ResearchEvidenceSnapshot | null;
  researchEvents?: InterviewResearchEvent[];
  isResearchActive?: boolean;
}

interface InterviewMessageProps {
  message: InterviewMessageData;
  onSendReply?: (text: string) => void;
  isStreaming?: boolean;
}

export function InterviewMessage({ message, onSendReply, isStreaming }: InterviewMessageProps) {
  const isUser = message.role === "user";
  const shouldShowOptions =
    !isUser && message.mode !== "outline" && (message.options?.length ?? 0) > 0;
  const hasActivity = message.researchEvidence || (message.researchEvents?.length ?? 0) > 0;
  const isActivityOnly =
    !isUser && hasActivity && !message.text && (message.options?.length ?? 0) === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      {isActivityOnly ? (
        <InterviewResearchActivity
          evidence={message.researchEvidence}
          events={message.researchEvents}
          defaultOpen={false}
          isRunning={message.isResearchActive ?? Boolean(isStreaming)}
        />
      ) : (
        <div
          className={cn(
            "min-w-0 break-words text-sm [overflow-wrap:anywhere]",
            isUser
              ? "ui-primary-button max-w-[min(78%,var(--message-max-width))] rounded-3xl rounded-br-md px-4 py-3"
              : "ui-message-card max-w-[var(--message-max-width)] rounded-[26px] px-4 py-3.5 text-[var(--color-text)]",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.text}
            </p>
          ) : (
            <>
              {hasActivity ? (
                <InterviewResearchActivity
                  evidence={message.researchEvidence}
                  events={message.researchEvents}
                  defaultOpen={message.isResearchActive ?? Boolean(isStreaming)}
                  isRunning={message.isResearchActive ?? Boolean(isStreaming)}
                />
              ) : null}
              {message.mode === "outline" && message.outlineComplete ? (
                <div className="mb-3 inline-flex items-center rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-secondary)]">
                  蓝图已更新
                </div>
              ) : null}
              {message.text && <StreamdownMessage content={message.text} />}
              {shouldShowOptions ? (
                <InterviewOptions
                  options={message.options ?? []}
                  onSelect={(option) => onSendReply?.(option.action || option.label)}
                  isStreaming={isStreaming}
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

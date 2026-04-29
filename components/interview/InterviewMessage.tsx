"use client";

import { motion } from "framer-motion";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { InterviewOptions, type Option } from "@/components/interview/InterviewOptions";
import { cn } from "@/lib/utils";

export interface InterviewMessageData {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "question" | "outline";
  options?: Option[];
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "text-sm",
          isUser
            ? "ui-primary-button max-w-[min(78%,var(--message-max-width))] rounded-3xl rounded-br-md px-4 py-3"
            : "ui-message-card max-w-[var(--message-max-width)] rounded-[26px] px-4 py-3.5 text-[var(--color-text)]",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-active)] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                课程访谈
              </span>
            </div>
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
    </motion.div>
  );
}

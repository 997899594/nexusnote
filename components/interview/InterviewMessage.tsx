"use client";

import { motion } from "framer-motion";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { InterviewOptions } from "@/components/interview/InterviewOptions";
import { cn } from "@/lib/utils";

export interface InterviewMessageData {
  id: string;
  role: "user" | "assistant";
  text: string;
  options?: string[];
}

interface InterviewMessageProps {
  message: InterviewMessageData;
  onSendReply?: (text: string) => void;
  isStreaming?: boolean;
}

export function InterviewMessage({ message, onSendReply, isStreaming }: InterviewMessageProps) {
  const isUser = message.role === "user";

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
            ? "max-w-[min(78%,var(--message-max-width))] rounded-3xl rounded-br-md bg-[#111827] px-4 py-3 text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)]"
            : "max-w-[var(--message-max-width)] rounded-[26px] border border-black/5 bg-white px-4 py-3.5 text-[var(--color-text)] shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                课程访谈
              </span>
            </div>
            {message.text && <StreamdownMessage content={message.text} />}
            <InterviewOptions
              options={message.options ?? []}
              onSelect={(option) => onSendReply?.(option)}
              isStreaming={isStreaming}
            />
          </>
        )}
      </div>
    </motion.div>
  );
}

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
          "max-w-[var(--message-max-width)] px-4 py-3 rounded-2xl text-sm",
          isUser
            ? "rounded-br-md bg-[#111827] text-white"
            : "rounded-bl-md bg-[#f3f5f8] text-[var(--color-text)]",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <>
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

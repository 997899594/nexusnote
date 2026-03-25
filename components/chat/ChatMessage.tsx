"use client";

import type { TextUIPart, ToolUIPart, UIMessage } from "ai";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StreamdownMessage } from "./StreamdownMessage";
import { ToolResultRenderer } from "./tool-result/ToolResultRenderer";

interface ChatMessageProps {
  message: UIMessage;
  onSendReply?: (text: string) => void;
  isStreaming?: boolean;
}

function isTextPart(part: { type: string }): part is TextUIPart {
  return part.type === "text";
}

function isToolPart(part: { type: string }): part is ToolUIPart {
  return part.type.startsWith("tool-");
}

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

function getToolParts(message: UIMessage): ToolUIPart[] {
  return message.parts.filter(isToolPart) as ToolUIPart[];
}

export function ChatMessage({ message, onSendReply, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = getTextContent(message);
  const toolParts = getToolParts(message);

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
            ? "rounded-br-md bg-[#111827] text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)]"
            : "rounded-bl-md bg-[#f3f5f8] text-[var(--color-text)]",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <>
            {content && <StreamdownMessage content={content} />}
            {toolParts.map((toolPart) => (
              <ToolResultRenderer
                key={toolPart.toolCallId}
                toolPart={toolPart}
                onSendReply={onSendReply}
                isStreaming={isStreaming}
              />
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
}

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex justify-start", className)}
    >
      <div className="rounded-2xl rounded-bl-md bg-[#f3f5f8] px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              className="w-1.5 h-1.5 bg-[var(--color-text-muted)] rounded-full"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

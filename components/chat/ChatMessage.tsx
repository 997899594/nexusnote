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
  variant?: "default" | "learning";
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

export function ChatMessage({
  message,
  onSendReply,
  isStreaming,
  variant = "default",
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = getTextContent(message);
  const toolParts = getToolParts(message);
  const isLearning = variant === "learning";

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
            : cn(
                "max-w-[var(--message-max-width)]",
                isLearning
                  ? "rounded-[26px] border border-black/5 bg-white px-4 py-3.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]"
                  : "rounded-2xl rounded-bl-md bg-[#f3f5f8] px-4 py-3 text-[var(--color-text)]",
              ),
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <>
            {isLearning && (
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  学习助手
                </span>
              </div>
            )}
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
  variant?: "default" | "learning";
}

export function LoadingDots({ className, variant = "default" }: LoadingDotsProps) {
  const isLearning = variant === "learning";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex justify-start", className)}
    >
      <div
        className={cn(
          isLearning
            ? "rounded-[26px] border border-black/5 bg-white px-4 py-3.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]"
            : "rounded-2xl rounded-bl-md bg-[#f3f5f8] px-4 py-3",
        )}
      >
        {isLearning && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              学习助手
            </span>
          </div>
        )}
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

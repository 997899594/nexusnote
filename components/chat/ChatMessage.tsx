"use client";

import { getToolName, type TextUIPart, type ToolUIPart, type UIMessage } from "ai";
import { motion } from "framer-motion";
import { isChatVisibleTool } from "@/lib/ai/tools/shared/display-contract";
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
  return (message.parts.filter(isToolPart) as ToolUIPart[]).filter((part) =>
    isChatVisibleTool(getToolName(part)),
  );
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

  if (!isUser && !content && toolParts.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "min-w-0 break-words text-sm [overflow-wrap:anywhere]",
          isUser
            ? "ui-primary-button max-w-[min(78%,var(--message-max-width))] rounded-3xl rounded-br-md px-4 py-3"
            : cn(
                "max-w-[var(--message-max-width)]",
                isLearning
                  ? "ui-message-card rounded-[26px] px-4 py-3.5"
                  : "ui-message-card rounded-[26px] px-4 py-3.5 text-[var(--color-text)]",
              ),
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</p>
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
            ? "ui-message-card rounded-[26px] px-4 py-3.5"
            : "ui-message-card rounded-[26px] px-4 py-3.5",
        )}
      >
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

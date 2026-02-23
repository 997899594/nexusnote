"use client";

import type { TextUIPart, UIMessage } from "ai";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StreamdownMessage } from "./StreamdownMessage";

interface ChatMessageProps {
  message: UIMessage;
}

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is TextUIPart => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = getTextContent(message);

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
            ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] rounded-br-md"
            : "bg-zinc-100 text-zinc-800 rounded-bl-md",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <StreamdownMessage content={content} />
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
      <div className="bg-zinc-100 px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

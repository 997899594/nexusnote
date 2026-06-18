"use client";

import { motion } from "framer-motion";
import { ChatActivityIndicator } from "@/components/chat/ChatActivityIndicator";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { ToolResultRenderer } from "@/components/chat/tool-result/ToolResultRenderer";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
import type { ChatDisplayMessage } from "@/lib/chat/message-ui";
import { cn } from "@/lib/utils";

interface LearnChatMessageProps {
  message: ChatDisplayMessage;
}

export function LearnChatMessage({ message }: LearnChatMessageProps) {
  const isUser = message.role === "user";
  const toolParts = message.toolParts ?? [];

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
            : "ui-message-card max-w-[var(--message-max-width)] rounded-[26px] px-4 py-3.5",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p>
        ) : (
          <>
            {message.researchSources ? (
              <ResearchSourceStrip
                sources={message.researchSources.sources}
                label={`来源 ${message.researchSources.sourceCount}`}
                defaultOpen={false}
                variant="compact"
                className={message.text ? "mb-2" : undefined}
              />
            ) : null}
            {message.activity ? <ChatActivityIndicator label={message.activity.label} /> : null}
            {message.text ? <StreamdownMessage content={message.text} /> : null}
            {toolParts.map((toolPart) => (
              <ToolResultRenderer key={toolPart.toolCallId} toolPart={toolPart} />
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
}

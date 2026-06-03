"use client";

import { getToolName, isDataUIPart, type TextUIPart, type ToolUIPart, type UIMessage } from "ai";
import { motion } from "framer-motion";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
import type { ResearchCitation } from "@/lib/ai/research/contracts";
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

interface ChatResearchSourcesData {
  sourceCount: number;
  completedAt: string;
  sources: ResearchCitation[];
}

function isTextPart(part: { type: string }): part is TextUIPart {
  return part.type === "text";
}

function isBackgroundResearchAcknowledgement(content: string): boolean {
  return content.trim() === "已开始深度研究。";
}

function stripMarkdownSourcesSection(content: string): string {
  return content.replace(/\n## 来源[\s\S]*$/u, "").trim();
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

function getResearchSources(message: UIMessage): ChatResearchSourcesData | null {
  if (message.role !== "assistant") {
    return null;
  }

  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];
    if (isDataUIPart(part) && part.type === "data-researchSources") {
      return part.data as ChatResearchSourcesData;
    }
  }

  return null;
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
  const researchSources = getResearchSources(message);
  const visibleContent = isBackgroundResearchAcknowledgement(content)
    ? ""
    : researchSources
      ? stripMarkdownSourcesSection(content)
      : content;
  const isLearning = variant === "learning";

  if (!isUser && !visibleContent && toolParts.length === 0 && !researchSources) {
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
            {researchSources ? (
              <ResearchSourceStrip
                sources={researchSources.sources}
                label={`来源 ${researchSources.sourceCount}`}
                defaultOpen={Boolean(isStreaming)}
                className={visibleContent ? "mb-3" : undefined}
              />
            ) : null}
            {visibleContent && <StreamdownMessage content={visibleContent} />}
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

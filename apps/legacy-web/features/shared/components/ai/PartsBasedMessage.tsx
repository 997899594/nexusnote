"use client";

import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { Bot } from "lucide-react";
import { type ReactNode } from "react";
import { MessageResponse } from "@/features/chat/components/ai/Message";
import { cn } from "@/features/shared/utils";

interface PartsBasedMessageProps {
  message: UIMessage;
  variant?: "chat" | "interview";
  isLastMessage?: boolean;
  renderToolOutput?: (toolName: string, output: unknown, toolCallId: string) => ReactNode;
  renderToolOptions?: (input: {
    options: string[];
    toolCallId: string;
  }) => ReactNode;
}

export function PartsBasedMessage({
  message,
  variant = "chat",
  isLastMessage = false,
  renderToolOutput,
  renderToolOptions,
}: PartsBasedMessageProps) {
  const text = message.parts
    ?.filter(isTextUIPart)
    .map((p) => p.text)
    .join("\n\n") || "";

  // 同时匹配 client-side 工具 (input-available) 和 server-side 工具 (output-available)
  // suggestOptions 如果是 client-side tool 则为 input-available
  // 如果是 server-side tool (有 execute) 则为 output-available
  const tools = message.parts
    ?.filter(isToolUIPart)
    .map(p => ({
      toolCallId: p.toolCallId,
      toolName: getToolName(p),
      input: p.input,
      state: p.state,
    })) || [];

  const isActive = isLastMessage;

  // 用户消息
  if (message.role === "user") {
    return (
      <div className="flex justify-end w-full">
        <div className="bg-black text-white px-6 py-3 rounded-[24px] max-w-[85%]">
          {text}
        </div>
      </div>
    );
  }

  // suggestOptions 工具渲染 — 支持 input-available（client-side）和 output-available（server-side）
  const suggestOptionsTool = tools.find(
    t => t.toolName === "suggestOptions" &&
      (t.state === "input-available" || t.state === "output-available")
  );
  const options = suggestOptionsTool
    ? (suggestOptionsTool.input as { options?: string[] })?.options || []
    : [];

  // Interview 变体
  if (variant === "interview") {
    return (
      <div className="flex justify-start w-full">
        {/* 消息气泡 */}
        <div
          className={cn(
            "text-left",
            isActive
              ? "bg-white shadow-xl shadow-black/5 px-8 py-6 rounded-[32px] max-w-[95%] border border-black/[0.02]"
              : "bg-black/5 px-6 py-3 rounded-[24px] max-w-[85%]",
          )}
        >
          {/* 文本 */}
          {text && (
            <MessageResponse
              className={cn(
                "leading-snug",
                isActive
                  ? "text-lg md:text-xl font-bold tracking-tight text-black"
                  : "text-sm md:text-base font-medium text-black/60 leading-relaxed",
              )}
            >
              {text}
            </MessageResponse>
          )}

          {/* 选项按钮 - 直接渲染在气泡下方 */}
          {options.length > 0 && renderToolOptions && (
            <div className="mt-4 pt-2 border-t border-black/10">
              {renderToolOptions({ options, toolCallId: suggestOptionsTool!.toolCallId })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat 变体
  return (
    <div className="flex gap-3 max-w-[95%] flex-row self-start mb-6">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex flex-col items-start min-w-0">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-glass",
            isActive
              ? "bg-surface border-2 border-primary/20"
              : "bg-surface border border-border/50 rounded-tl-sm",
          )}
        >
          {text ? (
            <MessageResponse>{text}</MessageResponse>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
            </div>
          )}

          {options.length > 0 && renderToolOptions && (
            <div className="mt-3">
              {renderToolOptions({ options, toolCallId: suggestOptionsTool!.toolCallId })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

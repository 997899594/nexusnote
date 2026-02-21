"use client";

import { type UIMessage as Message } from "ai";
import { Bot, Send, Square } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef } from "react";
import { PartsBasedMessage } from "@/features/shared/components/ai/PartsBasedMessage";
import { cn } from "@/features/shared/utils";

interface UnifiedChatUIProps {
  messages: Message[];
  isLoading: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onStop?: () => void;
  renderToolOutput?: (toolName: string, output: unknown, toolCallId: string) => ReactNode;
  renderToolLoading?: (toolName: string, toolCallId: string) => ReactNode;
  renderToolOptions?: (input: {
    options: string[];
    toolCallId: string;
  }) => ReactNode;
  renderMessage?: (message: Message, text: string, isUser: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderAfterMessages?: () => ReactNode;
  renderBeforeInput?: () => ReactNode;
  variant?: "chat" | "interview";
  placeholder?: string;
  scrollable?: boolean;
  showReasoningSection?: boolean;
}

/**
 * UnifiedChatUI v2 - Parts-Based Rendering
 *
 * 重构为使用 AI SDK v6 推荐的 parts-based 渲染架构
 * - 移除 getMessageContent() 合并逻辑
 * - 使用 PartsBasedMessage 直接基于 parts 数组渲染
 * - 支持视觉段落分割（工具输出后形成新气泡）
 */
export function UnifiedChatUI({
  messages,
  isLoading,
  input,
  onInputChange,
  onSubmit,
  onStop,
  renderToolOutput,
  renderToolLoading,
  renderToolOptions,
  renderEmpty,
  renderAfterMessages,
  renderBeforeInput,
  variant = "chat",
  placeholder = "输入指令...",
  scrollable = true,
  showReasoningSection = true,
}: UnifiedChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollable) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [scrollable]);

  const renderEmptyFn =
    renderEmpty ||
    (() => (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-40">
        <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center mb-4">
          <Bot className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">随时提问</p>
        <p className="text-xs mt-2 text-muted-foreground">试试："帮我总结当前的重点"</p>
      </div>
    ));

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-transparent"
      role="region"
      aria-label="聊天消息"
    >
      {/* 消息列表区域 */}
      <div
        className={cn(
          "flex-1 overflow-y-auto min-h-0",
          variant === "interview" ? "px-0" : "px-4 custom-scrollbar pb-8",
        )}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <div
          className={cn(
            "flex flex-col gap-6 mx-auto",
            variant === "interview" ? "max-w-full px-4 pt-4" : "max-w-4xl pt-4",
          )}
        >
          {messages.length === 0 ? (
            renderEmptyFn()
          ) : (
            <>
              {messages.map((message, idx) => {
                const messageKey = message.id || `msg-${idx}`;
                const isLastMessage = idx === messages.length - 1;

                return (
                  <div
                    key={messageKey}
                    className="flex flex-col w-full"
                    role="article"
                    aria-label={
                      message.role === "user" ? "用户消息" : "AI 助手回复"
                    }
                  >
                    <PartsBasedMessage
                      message={message}
                      variant={variant}
                      isLastMessage={isLastMessage}
                      renderToolOutput={renderToolOutput}
                      renderToolOptions={renderToolOptions}
                    />
                  </div>
                );
              })}
              {renderAfterMessages?.()}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* 输入框前的内容（如选项按钮） */}
      <div className="shrink-0">{renderBeforeInput?.()}</div>

      {/* 输入框区域 */}
      <div className={cn("shrink-0", variant === "interview" ? "p-4" : "p-4")}>
        <div className={cn("max-w-4xl mx-auto relative group", variant === "interview" && "max-w-full")}>
          <form onSubmit={onSubmit} className="relative" aria-label="发送消息">
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              className="w-full bg-surface border border-border/50 rounded-[1.5rem] pl-5 pr-12 py-3.5 text-sm shadow-float focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground touch-safe min-h-[44px]"
              aria-label="输入消息"
              aria-disabled={isLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface text-muted-foreground hover:text-foreground transition-colors touch-safe min-h-[36px]"
                  aria-label="停止生成"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-float hover:bg-primary/90 disabled:opacity-20 disabled:grayscale transition-all touch-safe min-h-[36px]"
                  aria-label="发送消息"
                  aria-disabled={!input.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * 默认的选项按钮渲染器
 */
export function DefaultOptionButtons({
  options,
  toolCallId,
  onSelect,
}: {
  options: string[];
  toolCallId: string;
  onSelect: (toolCallId: string, option: string) => void;
}) {
  console.log("[DefaultOptionButtons] Rendering with options:", options);
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onSelect(toolCallId, option)}
          className="bg-white/80 backdrop-blur-md border border-black/5 px-4 py-2 rounded-full text-sm font-medium hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5 hover:scale-105 active:scale-95"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

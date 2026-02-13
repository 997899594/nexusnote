"use client";

import { isReasoningUIPart, isToolUIPart, type UIMessage as Message } from "ai";
import { Bot, Send, Square, User } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef } from "react";
import { getMessageContent, getReasoningContent, getToolCalls } from "@/features/shared/ai/ui-utils";
import { MessageResponse } from "./Message";

interface UnifiedChatUIProps {
  messages: Message[];
  isLoading: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onStop?: () => void;
  renderToolOutput?: (
    toolName: string,
    output: unknown,
    toolCallId: string,
  ) => ReactNode;
  renderToolLoading?: (
    toolName: string,
    toolCallId: string,
  ) => ReactNode;
  renderMessage?: (
    message: Message,
    text: string,
    isUser: boolean,
  ) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderAfterMessages?: () => ReactNode;
  renderBeforeInput?: () => ReactNode;
  variant?: "chat" | "interview";
  placeholder?: string;
  scrollable?: boolean;
  showReasoningSection?: boolean;
}

export function UnifiedChatUI({
  messages,
  isLoading,
  input,
  onInputChange,
  onSubmit,
  onStop,
  renderToolOutput,
  renderToolLoading,
  renderMessage,
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

  const defaultRenderMessage = (
    message: Message,
    text: string,
    isUser: boolean,
  ) => {
    const reasoning = getReasoningContent(message);
    const toolCalls = getToolCalls(message);

    if (variant === "interview") {
      return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
          <div
            className={`${isUser ? "bg-primary px-6 py-3 rounded-[24px]" : "bg-surface/50 px-6 py-3 rounded-[24px]"} max-w-[85%] text-left`}
          >
            <p
              className={`text-sm md:text-base font-medium ${isUser ? "text-primary-foreground font-bold text-right" : "text-muted-foreground"} leading-relaxed`}
            >
              {text}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex gap-3 max-w-[95%] ${isUser ? "flex-row-reverse self-end" : "flex-row self-start"}`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isUser
              ? "bg-surface"
              : "bg-primary/10 text-primary"
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        <div
          className={`flex flex-col ${isUser ? "items-end" : "items-start"} min-w-0`}
        >
          {!isUser && reasoning && showReasoningSection && (
            <details className="mb-2 group">
              <summary className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5 cursor-pointer list-none hover:text-foreground transition-colors">
                <span className="w-1 h-1 rounded-full bg-muted-foreground group-open:bg-primary" />
                思维链
              </summary>
              <div className="text-xs text-muted-foreground glass p-3 rounded-xl italic leading-relaxed whitespace-pre-wrap">
                {reasoning}
              </div>
            </details>
          )}

          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-glass ${
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-surface border border-border/50 rounded-tl-sm"
            }`}
          >
            {text ? (
              <MessageResponse className={isUser ? "text-primary-foreground" : ""}>
                {text}
              </MessageResponse>
            ) : (
              isLoading &&
              toolCalls.length === 0 && (
                <div className="flex items-center gap-2 text-muted-foreground py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                </div>
              )
            )}
          </div>

          {!isUser && toolCalls.length > 0 && (
            <div className="mt-2 space-y-2 w-full">
              {toolCalls.map((tool) => {
                const { toolName, state, output, toolCallId, errorText } = tool;

                if (state === "output-available" && renderToolOutput) {
                  return (
                    <div key={toolCallId}>{renderToolOutput(toolName, output, toolCallId)}</div>
                  );
                }

                if (
                  state === "input-streaming" ||
                  state === "input-available"
                ) {
                  if (renderToolLoading) {
                    const loadingComponent = renderToolLoading(toolName, toolCallId);
                    if (loadingComponent) {
                      return <div key={toolCallId}>{loadingComponent}</div>;
                    }
                  }
                  return (
                    <div
                      key={toolCallId}
                      className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium py-1 px-2 glass rounded-lg w-fit"
                    >
                      <div className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      正在运行 {toolName}...
                    </div>
                  );
                }

                if (state === "output-error") {
                  return (
                    <div
                      key={toolCallId}
                      className="text-[11px] text-destructive glass glass-lg p-3 rounded-lg border-l-4 border-destructive/50"
                    >
                      {toolName} 执行失败: {errorText || "未知错误"}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

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

  const renderFn = renderMessage || defaultRenderMessage;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent" role="region" aria-label="聊天消息">
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-8 min-h-0" role="log" aria-live="polite" aria-atomic="false">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto pt-4">
          {messages.length === 0 ? (
            renderEmptyFn()
          ) : (
            <>
              {messages.map((message, idx) => {
                const text = getMessageContent(message);
                const isUser = message.role === "user";
                const hasReasoning = message.parts?.some(isReasoningUIPart);
                const hasToolCalls = message.parts?.some(isToolUIPart);
                const messageKey = message.id || `msg-${idx}`;

                const hasContent =
                  text || isUser || hasReasoning || hasToolCalls || isLoading;

                if (!hasContent) {
                  return null;
                }

                return (
                  <div key={messageKey} className="flex flex-col" role="article" aria-label={isUser ? "用户消息" : "AI 助手回复"}>
                    {renderFn(message, text, isUser)}
                  </div>
                );
              })}
              {renderAfterMessages?.()}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      <div className="shrink-0">{renderBeforeInput?.()}</div>

      <div className="p-4 shrink-0">
        <div className="max-w-4xl mx-auto relative group">
          <form onSubmit={onSubmit} className="relative" role="form" aria-label="发送消息">
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

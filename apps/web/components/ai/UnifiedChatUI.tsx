"use client";

import { isReasoningUIPart, isToolUIPart, type UIMessage as Message } from "ai";
import { Bot, Send, Square, User } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useRef } from "react";
import { getMessageContent, getReasoningContent, getToolCalls } from "@/lib/ai/ui-utils";
import { MessageResponse } from "./Message";

/**
 * 通用聊天 UI 组件 - 2026 架构师标准版
 *
 * 核心设计原则：
 * 1. Schema-First: 使用 getMessageContent 等工具函数统一提取内容
 * 2. 类型安全：全面应用 isTextUIPart, isToolUIPart 等类型守卫
 * 3. 逻辑解耦：UI 渲染逻辑与消息处理逻辑分离
 * 4. 职责单一：组件只负责消息流的布局和基础交互
 */

interface UnifiedChatUIProps {
  // 消息和状态
  messages: Message[];
  isLoading: boolean;

  // 输入控制
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onStop?: () => void;

  // 自定义渲染
  renderToolOutput?: (toolName: string, output: unknown, toolCallId: string) => ReactNode;
  renderToolLoading?: (toolName: string, toolCallId: string) => ReactNode;
  renderMessage?: (message: Message, text: string, isUser: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderAfterMessages?: () => ReactNode;
  renderBeforeInput?: () => ReactNode;

  // 样式和行为
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

  // 自动滚动到底部
  useEffect(() => {
    if (scrollable) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [scrollable]);

  /**
   * 默认消息渲染函数
   * 处理：文本、思维链、工具输出
   */
  const defaultRenderMessage = (message: Message, text: string, isUser: boolean) => {
    const reasoning = getReasoningContent(message);
    const toolCalls = getToolCalls(message);

    if (variant === "interview") {
      return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
          <div
            className={`${isUser ? "bg-black px-6 py-3 rounded-[24px]" : "bg-black/5 px-6 py-3 rounded-[24px]"} max-w-[85%] text-left`}
          >
            <p
              className={`text-sm md:text-base font-medium ${isUser ? "text-white font-bold text-right" : "text-black/60"} leading-relaxed`}
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
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isUser
              ? "bg-neutral-100 dark:bg-neutral-800"
              : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} min-w-0`}>
          {/* Reasoning Section (Collapsible) */}
          {!isUser && reasoning && showReasoningSection && (
            <details className="mb-2 group">
              <summary className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1 flex items-center gap-1.5 cursor-pointer list-none hover:text-neutral-500 transition-colors">
                <span className="w-1 h-1 rounded-full bg-neutral-300 group-open:bg-violet-400" />
                思维链
              </summary>
              <div className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 border border-neutral-100 dark:border-white/5 italic leading-relaxed whitespace-pre-wrap">
                {reasoning}
              </div>
            </details>
          )}

          {/* Message Bubble */}
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
              isUser
                ? "bg-violet-600 text-white rounded-tr-sm"
                : "bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 rounded-tl-sm"
            }`}
          >
            {text ? (
              <MessageResponse className={isUser ? "text-white" : ""}>{text}</MessageResponse>
            ) : (
              isLoading &&
              toolCalls.length === 0 && (
                <div className="flex items-center gap-2 text-neutral-400 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-bounce" />
                </div>
              )
            )}
          </div>

          {/* Tool Status & Outputs */}
          {!isUser && toolCalls.length > 0 && (
            <div className="mt-2 space-y-2 w-full">
              {toolCalls.map((tool) => {
                const { toolName, state, output, toolCallId, errorText } = tool;

                // 1. 执行完成且有渲染器
                if (state === "output-available" && renderToolOutput) {
                  return (
                    <div key={toolCallId}>{renderToolOutput(toolName, output, toolCallId)}</div>
                  );
                }

                // 2. 正在执行中
                if (state === "input-streaming" || state === "input-available") {
                  // 优先使用自定义骨架屏组件
                  if (renderToolLoading) {
                    const loadingComponent = renderToolLoading(toolName, toolCallId);
                    if (loadingComponent) {
                      return <div key={toolCallId}>{loadingComponent}</div>;
                    }
                  }
                  // 默认加载指示器
                  return (
                    <div
                      key={toolCallId}
                      className="flex items-center gap-2 text-[11px] text-neutral-400 font-medium py-1 px-2 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg w-fit"
                    >
                      <div className="w-2.5 h-2.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      正在运行 {toolName}...
                    </div>
                  );
                }

                // 3. 执行错误
                if (state === "output-error") {
                  return (
                    <div
                      key={toolCallId}
                      className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/20"
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
        <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mb-4">
          <Bot className="w-6 h-6 text-neutral-400" />
        </div>
        <p className="text-sm font-medium">随时提问</p>
        <p className="text-xs mt-2">试试："帮我总结当前的重点"</p>
      </div>
    ));

  const renderFn = renderMessage || defaultRenderMessage;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-8 min-h-0">
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

                // 2026 修复：更宽松的过滤逻辑，确保有工具调用的消息不会被过滤
                // 即使工具调用处于 input-streaming/input-available 状态，也要保留消息
                const hasContent = text || isUser || hasReasoning || hasToolCalls || isLoading;

                if (!hasContent) {
                  return null;
                }

                return (
                  <div key={messageKey} className="flex flex-col">
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

      {/* 悬浮/固定内容区域（如选项、状态提示等） */}
      <div className="shrink-0">{renderBeforeInput?.()}</div>

      {/* 输入表单 */}
      <div className="p-4 shrink-0">
        <div className="max-w-4xl mx-auto relative group">
          <form onSubmit={onSubmit} className="relative">
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              className="w-full bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/5 rounded-[1.5rem] pl-5 pr-12 py-3.5 text-sm shadow-xl shadow-black/[0.02] focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all placeholder:text-neutral-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-20 disabled:grayscale transition-all"
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

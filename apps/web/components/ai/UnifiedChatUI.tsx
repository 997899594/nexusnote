"use client";

import { FormEvent, useEffect, useRef, ReactNode } from "react";
import {
  isTextUIPart,
  isToolUIPart,
  isReasoningUIPart,
  getToolName,
  UIMessage as Message,
} from "ai";
import { Send, Square, Loader2, User, Bot } from "lucide-react";

/**
 * 通用聊天 UI 组件
 *
 * 提取 ChatSidebar 和 ChatInterface 的公共 UI 逻辑
 * - 消息渲染（用户/助手）
 * - 推理过程展示
 * - 输入表单和发送按钮
 * - 自动滚动到底部
 * - 加载状态
 *
 * 通过 props 支持差异化：
 * - renderToolOutput: 工具输出自定义渲染
 * - renderMessage: 消息卡片自定义样式
 * - renderEmpty: 空状态自定义
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
  renderToolOutput?: (
    toolName: string,
    output: unknown,
    toolCallId: string
  ) => ReactNode;
  renderMessage?: (
    message: Message,
    text: string,
    isUser: boolean
  ) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderAfterMessages?: () => ReactNode;
  renderBeforeInput?: () => ReactNode;

  // 样式和行为
  variant?: "chat" | "interview";
  placeholder?: string;
  scrollable?: boolean;
  showReasoningSection?: boolean;
}

// 辅助函数：提取消息文本（仅从 parts 中提取）
function getMessageText(message: Message): string {
  if (!message.parts || message.parts.length === 0) return "";
  return message.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");
}


export function UnifiedChatUI({
  messages,
  isLoading,
  input,
  onInputChange,
  onSubmit,
  onStop,
  renderToolOutput,
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
  }, [messages, scrollable]);

  // 默认消息渲染
  const defaultRenderMessage = (
    message: Message,
    text: string,
    isUser: boolean
  ) => {
    if (variant === "interview") {
      // Interview 样式
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

    // Chat 样式（带图标和操作按钮）
    return (
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div className={`flex gap-3 max-w-[92%] ${isUser ? "flex-row-reverse" : ""}`}>
          <div
            className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${
              message.role === "assistant"
                ? "bg-violet-500/20 text-violet-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {message.role === "assistant" ? (
              <Bot className="w-4 h-4" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                isUser
                  ? "bg-violet-600 text-white rounded-tr-sm"
                  : "bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 rounded-tl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{text || (isLoading ? "思考中..." : "")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 默认空状态
  const defaultRenderEmpty = () => {
    if (variant === "interview") {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-black/40">
          <p className="text-sm font-medium">准备开始对话...</p>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-40">
        <p className="text-sm font-medium">随时提问</p>
        <p className="text-xs mt-2">试试："帮我总结当前的重点"</p>
      </div>
    );
  };

  const renderFn = renderMessage || defaultRenderMessage;
  const renderEmptyFn = renderEmpty || defaultRenderEmpty;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar pb-4 min-h-0">
        {messages.length === 0 ? (
          renderEmptyFn()
        ) : (
          <>
            {messages.map((message, idx) => {
              const text = getMessageText(message);
              const isUser = message.role === "user";
              const messageKey = message.id || `msg-${idx}`;

              // 跳过空的助手消息
              if (!text && !isUser) return null;

              return (
                <div key={messageKey} className="flex flex-col gap-2">
                  {/* 消息卡片 */}
                  {renderFn(message, text, isUser)}

                  {/* 推理过程 */}
                  {showReasoningSection &&
                    !isUser &&
                    message.parts?.some(isReasoningUIPart) && (
                      <div className="flex justify-start">
                        <details className="bg-black/[0.02] dark:bg-white/[0.02] px-6 py-4 rounded-[24px] max-w-[95%] border border-black/[0.05] dark:border-white/[0.05]">
                          <summary className="cursor-pointer text-sm font-medium text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition-colors">
                            💭 查看 AI 思考过程
                          </summary>
                          <div className="mt-4 text-sm text-black/60 dark:text-white/60 leading-relaxed whitespace-pre-wrap">
                            {message.parts
                              ?.filter(isReasoningUIPart)
                              .map((p, i) => (
                                <div key={i}>{p.text}</div>
                              ))}
                          </div>
                        </details>
                      </div>
                    )}

                  {/* 工具输出 */}
                  {renderToolOutput && !isUser && message.parts && (
                    <div className="space-y-2">
                      {message.parts
                        .filter(isToolUIPart)
                        .map((part) => {
                          const toolName = getToolName(part);
                          const toolCallId = part.toolCallId;

                          if (part.state === "output-available") {
                            return (
                              <div key={toolCallId} className="mt-3">
                                {renderToolOutput(toolName, part.output, toolCallId)}
                              </div>
                            );
                          }

                          if (part.state === "input-streaming" || part.state === "input-available") {
                            return (
                              <div
                                key={toolCallId}
                                className="flex items-center gap-2 text-xs text-muted-foreground py-2"
                              >
                                <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                正在执行 {toolName}...
                              </div>
                            );
                          }

                          if (part.state === "output-error") {
                            return (
                              <div key={toolCallId} className="text-xs text-red-500 py-2">
                                {toolName} 执行失败: {part.errorText || "未知错误"}
                              </div>
                            );
                          }

                          return null;
                        })}
                    </div>
                  )}
                </div>
              );
            })}
            {renderAfterMessages?.()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入框上方的固定内容（如选项按钮） */}
      {renderBeforeInput?.()}

      {/* 输入表单 */}
      <div className="p-4 border-t border-black/5 dark:border-white/5 backdrop-blur-3xl shrink-0">
        <form onSubmit={onSubmit} className="relative group">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[1.5rem] pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all placeholder:text-muted-foreground/50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="w-9 h-9 flex items-center justify-center bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-9 h-9 flex items-center justify-center bg-violet-600 text-white rounded-full disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-violet-950/20 hover:scale-105 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

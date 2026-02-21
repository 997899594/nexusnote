"use client";

import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type OptionButtonsProps } from "../types";

// 子组件：漂亮的选项按钮
function OptionButtons({ options, onSelect, disabled }: OptionButtonsProps) {
  if (!options?.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          disabled={disabled}
          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-blue-100"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// 主组件
export default function InterviewChatV2() {
  const {
    messages,
    sendMessage,
    addToolOutput,
    status,
  } = useChat({
    id: "interview-v2",
  });

  // 手动管理输入状态
  const [input, setInput] = useState("");
  const isLoading = status === "streaming" || status === "submitted";

  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 处理选项点击
  const handleOptionSelect = useCallback((toolCallId: string, value: string) => {
    // 使用 addToolOutput 传递用户选择
    (addToolOutput as Function)({
      toolCallId,
      output: { selected: value },
    });
  }, [addToolOutput]);

  // 处理发送消息
  const handleSendMessage = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    sendMessage({ text: input });
    setInput("");
  }, [input, sendMessage]);

  // 渲染单个消息
  const renderMessage = (m: UIMessage) => {
    const isUser = m.role === "user";

    // 提取文本内容
    let textContent = "";
    if (m.parts) {
      for (const part of m.parts) {
        if (isTextUIPart(part)) {
          textContent += part.text;
        }
      }
    }

    // 提取工具调用
    const toolParts = m.parts?.filter(isToolUIPart) || [];

    return (
      <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* 消息气泡 */}
        <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-black text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}>
          {/* 文本内容 */}
          {textContent && (
            <span className="whitespace-pre-wrap">{textContent}</span>
          )}

          {/* 工具选项按钮 */}
          {!isUser && toolParts.map((part) => {
            const toolName = getToolName(part);
            const toolCallId = part.toolCallId;
            const input = part.input as { options?: string[] } | undefined;

            // 只处理 suggestOptions 工具
            if (toolName !== "suggestOptions") return null;

            // 检查状态
            const hasOutput = part.state === "output-available";

            if (hasOutput) {
              // 已选择状态
              return (
                <div key={toolCallId} className="mt-2 pt-2 border-t border-gray-200/50 text-xs opacity-60 flex items-center gap-1">
                  <span>✓ 已选择</span>
                </div>
              );
            }

            // 未选择状态：显示按钮
            const options = input?.options || [];
            return (
              <OptionButtons
                key={toolCallId}
                options={options}
                disabled={isLoading}
                onSelect={(val) => handleOptionSelect(toolCallId, val)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto border border-gray-200 rounded-xl shadow-sm bg-white overflow-hidden">
      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map(renderMessage)}

        {/* Loading Indicator */}
        {isLoading && messages.at(-1)?.role === 'user' && (
          <div className="flex items-center gap-2 ml-4 text-gray-400 text-xs animate-pulse">
            <div className="w-2 h-2 bg-gray-300 rounded-full" />
            <span>AI 正在思考...</span>
          </div>
        )}
      </div>

      {/* 输入框区域 */}
      <form onSubmit={handleSendMessage} className="p-4 bg-gray-50 border-t border-gray-100">
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的回答..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}

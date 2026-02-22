/**
 * AI Menu - 上下文 AI 操作菜单
 */

"use client";

import { useState } from "react";

export type AIAction =
  | "improve"
  | "proofread"
  | "simplify"
  | "expand"
  | "summarize"
  | "translate"
  | "emoji"
  | "format";

export interface AIMenuState {
  isOpen: boolean;
  selectedText: string;
  action: AIAction | null;
}

interface AIMenuProps {
  onAction: (action: AIAction, text: string) => void;
  selectedText?: string;
}

export function AIMenu({ onAction, selectedText = "" }: AIMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions: { id: AIAction; label: string; icon: string; description: string }[] = [
    { id: "improve", label: "改进写作", icon: "✏️", description: "让文本更清晰、专业" },
    { id: "proofread", label: "校对", icon: "🔍", description: "检查语法和拼写错误" },
    { id: "simplify", label: "简化", icon: "📝", description: "简化复杂文本" },
    { id: "expand", label: "扩展", icon: "📖", description: "扩展和丰富内容" },
    { id: "summarize", label: "摘要", icon: "📋", description: "生成内容摘要" },
    { id: "translate", label: "翻译", icon: "🌍", description: "翻译成其他语言" },
    { id: "emoji", label: "添加表情", icon: "😊", description: "添加相关表情符号" },
    { id: "format", label: "格式化", icon: "🎨", description: "优化文本格式" },
  ];

  const handleAction = (action: AIAction) => {
    onAction(action, selectedText);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-4 py-2 font-medium text-white border rounded-lg cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-white/20"
      >
        <span>✨</span>
        <span>AI</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 z-50 min-w-[240px] mt-2 overflow-hidden bg-white border rounded-xl shadow-elevated top-full">
          <div className="px-3 py-2 text-xs font-medium text-text-secondary bg-muted border-b border-border">
            选择 AI 操作
          </div>
          {actions.map((action) => (
            <button
              type="button"
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="w-full inline-flex items-center gap-3 px-4 py-3 text-left border-none bg-transparent cursor-pointer hover:bg-hover border-b border-border-subtle last:border-b-0 transition-colors"
            >
              <span className="text-lg">{action.icon}</span>
              <div>
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-xs text-text-secondary">{action.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIQuickActions({ onAction }: { onAction: (action: AIAction) => void }) {
  const actions = [
    { id: "improve", icon: "✏️" },
    { id: "proofread", icon: "🔍" },
    { id: "simplify", icon: "📝" },
    { id: "expand", icon: "📖" },
  ] as const;

  return (
    <div className="flex gap-1">
      {actions.map((action) => (
        <button
          type="button"
          key={action.id}
          onClick={() => onAction(action.id as AIAction)}
          title={action.id}
          className="px-2.5 py-1.5 text-base bg-white border rounded-md cursor-pointer border-border hover:bg-hover"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

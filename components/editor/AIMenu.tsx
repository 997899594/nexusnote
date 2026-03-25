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
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl bg-[#111827] px-4 py-2 text-sm font-medium text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.32)]"
      >
        <span>✨</span>
        <span>AI</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[240px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]">
          <div className="bg-[#f6f7f9] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
            选择 AI 操作
          </div>
          {actions.map((action) => (
            <button
              type="button"
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="inline-flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-3 text-left transition-colors hover:bg-[#f6f7f9]"
            >
              <span className="text-lg">{action.icon}</span>
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{action.label}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {action.description}
                </div>
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
          className="cursor-pointer rounded-xl bg-white px-2.5 py-1.5 text-base shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)] transition-colors hover:bg-[#f6f7f9]"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

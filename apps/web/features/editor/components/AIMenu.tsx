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
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          border: "1px solid #ddd",
          borderRadius: 8,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        <span>✨</span>
        <span>AI</span>
      </button>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 8,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            minWidth: 240,
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div
            style={{ padding: "8px 12px", borderBottom: "1px solid #eee", background: "#f9fafb" }}
          >
            <span style={{ fontSize: 12, color: "#666" }}>选择 AI 操作</span>
          </div>
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                borderBottom: "1px solid #f0f0f0",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 18 }}>{action.icon}</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{action.label}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{action.description}</div>
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
    <div style={{ display: "flex", gap: 4 }}>
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id as AIAction)}
          title={action.id}
          style={{
            padding: "6px 10px",
            border: "1px solid #eee",
            borderRadius: 6,
            background: "white",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

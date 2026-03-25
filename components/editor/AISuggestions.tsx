/**
 * AI Suggestions - 建议模式 (接受/拒绝)
 * Google Docs 风格的 AI 建议 UI
 */

"use client";

import { createContext, useContext, useState } from "react";

export interface AISuggestion {
  id: string;
  type: "insert" | "replace" | "delete" | "format";
  originalContent?: string;
  suggestedContent: string;
  explanation: string;
  position?: { from: number; to: number };
  accepted: boolean;
  rejected: boolean;
  createdAt: Date;
}

interface SuggestionContextValue {
  suggestions: AISuggestion[];
  addSuggestion: (
    suggestion: Omit<AISuggestion, "id" | "accepted" | "rejected" | "createdAt">,
  ) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  clearSuggestions: () => void;
  hasPendingSuggestions: () => boolean;
}

const SuggestionContext = createContext<SuggestionContextValue | null>(null);

export function useSuggestions() {
  const context = useContext(SuggestionContext);
  if (!context) throw new Error("useSuggestions must be used within SuggestionProvider");
  return context;
}

export function SuggestionProvider({ children }: { children: React.ReactNode }) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);

  const addSuggestion = (
    suggestion: Omit<AISuggestion, "id" | "accepted" | "rejected" | "createdAt">,
  ) => {
    const newSuggestion: AISuggestion = {
      ...suggestion,
      id: crypto.randomUUID(),
      accepted: false,
      rejected: false,
      createdAt: new Date(),
    };
    setSuggestions((prev) => [...prev, newSuggestion]);
  };

  const acceptSuggestion = (id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, accepted: true } : s)));
  };

  const rejectSuggestion = (id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, rejected: true } : s)));
  };

  const clearSuggestions = () => setSuggestions([]);

  const hasPendingSuggestions = () => suggestions.some((s) => !s.accepted && !s.rejected);

  return (
    <SuggestionContext.Provider
      value={{
        suggestions,
        addSuggestion,
        acceptSuggestion,
        rejectSuggestion,
        clearSuggestions,
        hasPendingSuggestions,
      }}
    >
      {children}
    </SuggestionContext.Provider>
  );
}

export function AISuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: AISuggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (suggestion.accepted || suggestion.rejected) return null;

  const getTypeColor = () => {
    switch (suggestion.type) {
      case "insert":
        return { bg: "bg-[#f8fafc]", badge: "bg-[#111827]" };
      case "replace":
        return { bg: "bg-[#f8fafc]", badge: "bg-[#111827]" };
      case "delete":
        return { bg: "bg-[#f8fafc]", badge: "bg-zinc-500" };
      default:
        return { bg: "bg-[#f8fafc]", badge: "bg-zinc-500" };
    }
  };

  const typeLabel = {
    insert: "新增",
    replace: "替换",
    delete: "删除",
    format: "格式",
  }[suggestion.type];

  const colors = getTypeColor();

  return (
    <div
      className={`${colors.bg} mx-2 my-2 overflow-hidden rounded-2xl shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)]`}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <span className={`${colors.badge} text-white text-xs px-2 py-0.5 rounded`}>
            {typeLabel}
          </span>
          <span className="text-sm text-text-secondary">{suggestion.explanation}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReject}
            className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-sm text-[var(--color-text-secondary)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] hover:bg-[#f6f7f9]"
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="cursor-pointer rounded-xl bg-[#111827] px-3 py-1.5 text-sm text-white"
          >
            接受
          </button>
        </div>
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="cursor-pointer border-none bg-transparent text-sm text-[#111827] hover:underline"
        >
          {expanded ? "隐藏详情 ▲" : "查看详情 ▼"}
        </button>
        {expanded && (
          <div className="mt-2 rounded-xl bg-white p-3 text-sm shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)]">
            {suggestion.originalContent && (
              <div>
                <div className="mb-1 text-zinc-500">原文:</div>
                <pre className="m-0 whitespace-pre-wrap">{suggestion.originalContent}</pre>
              </div>
            )}
            {suggestion.suggestedContent && (
              <div className={suggestion.originalContent ? "mt-3" : ""}>
                <div className="mb-1 text-[#111827]">建议:</div>
                <pre className="m-0 whitespace-pre-wrap">{suggestion.suggestedContent}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SuggestionPanel({ onApplyAll }: { onApplyAll?: () => void }) {
  const { suggestions, acceptSuggestion, rejectSuggestion } = useSuggestions();
  const pending = suggestions.filter((s) => !s.accepted && !s.rejected);

  if (pending.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-h-[50vh] w-[360px] overflow-y-auto rounded-[24px] bg-white p-4 shadow-[0_28px_64px_-36px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="m-0 text-base font-medium">AI 建议 ({pending.length})</h3>
        {onApplyAll && (
          <button
            type="button"
            onClick={onApplyAll}
            className="cursor-pointer rounded-xl bg-[#111827] px-3 py-1 text-sm text-white"
          >
            全部接受
          </button>
        )}
      </div>
      {pending.map((s) => (
        <AISuggestionCard
          key={s.id}
          suggestion={s}
          onAccept={() => acceptSuggestion(s.id)}
          onReject={() => rejectSuggestion(s.id)}
        />
      ))}
    </div>
  );
}

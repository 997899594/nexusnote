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
        return { bg: "bg-sky-50", badge: "bg-sky-500" };
      case "replace":
        return { bg: "bg-orange-50", badge: "bg-orange-500" };
      case "delete":
        return { bg: "bg-red-50", badge: "bg-red-500" };
      default:
        return { bg: "bg-gray-50", badge: "bg-gray-500" };
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
    <div className={`${colors.bg} border border-border rounded-lg mx-2 my-2 overflow-hidden`}>
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
            className="px-3 py-1.5 text-sm bg-white border border-border rounded-md cursor-pointer hover:bg-hover"
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-3 py-1.5 text-sm text-white bg-accent rounded-md cursor-pointer hover:bg-accent-hover"
          >
            接受
          </button>
        </div>
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="bg-transparent border-none text-accent cursor-pointer text-sm hover:underline"
        >
          {expanded ? "隐藏详情 ▲" : "查看详情 ▼"}
        </button>
        {expanded && (
          <div className="mt-2 p-2 bg-white rounded-md text-sm">
            {suggestion.originalContent && (
              <div>
                <div className="text-red-500 mb-1">原文:</div>
                <pre className="m-0 whitespace-pre-wrap">{suggestion.originalContent}</pre>
              </div>
            )}
            {suggestion.suggestedContent && (
              <div className={suggestion.originalContent ? "mt-3" : ""}>
                <div className="text-sky-500 mb-1">建议:</div>
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
    <div className="fixed right-5 bottom-5 z-50 w-[360px] max-h-[50vh] overflow-y-auto bg-white rounded-xl shadow-elevated p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="m-0 text-base font-medium">AI 建议 ({pending.length})</h3>
        {onApplyAll && (
          <button
            type="button"
            onClick={onApplyAll}
            className="px-3 py-1 text-sm text-white bg-accent rounded cursor-pointer hover:bg-accent-hover"
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

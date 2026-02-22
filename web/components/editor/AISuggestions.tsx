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

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        margin: "8px 0",
        background:
          suggestion.type === "insert"
            ? "#f0f9ff"
            : suggestion.type === "replace"
              ? "#fff7ed"
              : "#fef2f2",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
              background:
                suggestion.type === "insert"
                  ? "#0ea5e9"
                  : suggestion.type === "replace"
                    ? "#f97316"
                    : "#ef4444",
              color: "white",
            }}
          >
            {suggestion.type === "insert"
              ? "新增"
              : suggestion.type === "replace"
                ? "替换"
                : "删除"}
          </span>
          <span style={{ fontSize: 13, color: "#666" }}>{suggestion.explanation}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onReject}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "white",
              cursor: "pointer",
            }}
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 6,
              background: "#0070f3",
              color: "white",
              cursor: "pointer",
            }}
          >
            接受
          </button>
        </div>
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            color: "#0070f3",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {expanded ? "隐藏详情 ▲" : "查看详情 ▼"}
        </button>
        {expanded && (
          <div
            style={{ marginTop: 8, padding: 8, background: "white", borderRadius: 4, fontSize: 13 }}
          >
            {suggestion.originalContent && (
              <div>
                <div style={{ color: "#ef4444", marginBottom: 4 }}>原文:</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {suggestion.originalContent}
                </pre>
              </div>
            )}
            {suggestion.suggestedContent && (
              <div style={{ marginTop: suggestion.originalContent ? 12 : 0 }}>
                <div style={{ color: "#0ea5e9", marginBottom: 4 }}>建议:</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {suggestion.suggestedContent}
                </pre>
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
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 360,
        maxHeight: "50vh",
        overflowY: "auto",
        background: "white",
        borderRadius: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>AI 建议 ({pending.length})</h3>
        {onApplyAll && (
          <button
            type="button"
            onClick={onApplyAll}
            style={{
              padding: "4px 12px",
              border: "none",
              borderRadius: 4,
              background: "#0070f3",
              color: "white",
              cursor: "pointer",
              fontSize: 13,
            }}
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

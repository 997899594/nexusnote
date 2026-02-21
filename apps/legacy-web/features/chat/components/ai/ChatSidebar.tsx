"use client";

import { useChat } from "@ai-sdk/react";
import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  Ghost,
  Globe,
  Lightbulb,
  MessageSquare,
  Pencil,
  Sparkles,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import type { ChatAgentMessage } from "@/features/chat/agents/chat-agent";
import { useWebSearchToggle } from "@/features/chat/hooks/use-web-search-toggle";
import type { MindMapNode, Question } from "@/features/chat/tools/chat/learning";
import type { EditCommand } from "@/features/editor/core/document-parser";
import { useNoteExtractionOptional } from "@/features/learning/hooks/use-note-extraction";
import type {
  BatchEditOutput,
  DraftContentOutput,
  EditDocumentOutput,
  FlashcardOutput,
  LearningPlanOutput,
  MindMapOutput,
  QuizOutput,
  ReviewStatsOutput,
  SearchNotesOutput,
  SummarizeOutput,
  WebSearchOutput,
} from "@/features/learning/tools/types";
import { getMessageContent, getToolCalls } from "@/features/shared/ai/ui-utils";
import { useEditor } from "@/lib/store";
import { KnowledgePanel } from "./KnowledgePanel";
import { UnifiedChatUI } from "./UnifiedChatUI";
import {
  EditConfirmCard,
  FlashcardCreated,
  LearningPlan,
  MindMapSkeleton,
  MindMapView,
  QuizResult,
  QuizSkeleton,
  ReviewStats,
  SearchResults,
  SummaryResult,
  SummarySkeleton,
  WebSearchResult,
} from "./ui";

type SidebarMode = "chat" | "knowledge";

interface PendingEdit {
  toolCallId: string;
  action: string;
  targetId: string;
  newContent?: string;
  originalContent?: string;
  explanation: string;
}

export function ChatSidebar() {
  const [mode, setMode] = useState<SidebarMode>("chat");
  const [enableRAG, setEnableRAG] = useState(false);
  const { webSearchEnabled, setWebSearchEnabled, toggleWebSearch } = useWebSearchToggle();
  const [useDocContext, setUseDocContext] = useState(true);
  const [editMode, setEditMode] = useState(true);
  const [input, setInput] = useState("");
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(new Map());
  const [appliedEdits, setAppliedEdits] = useState<Set<string>>(new Set());
  const [_extractedNotes, _setExtractedNotes] = useState<Set<string>>(new Set());
  const editorContext = useEditor();
  const _noteExtraction = useNoteExtractionOptional();

  const { messages, sendMessage, status, stop } = useChat<ChatAgentMessage>({
    id: "chat-sidebar",
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (!editorContext) return;

    const newPendingEdits = new Map<string, PendingEdit>();

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      const toolCalls = getToolCalls(message);
      for (const tool of toolCalls) {
        const { toolName, output, toolCallId, state } = tool;

        if (toolName !== "editDocument" && toolName !== "batchEdit" && toolName !== "draftContent")
          continue;

        if (appliedEdits.has(toolCallId)) continue;

        if (state === "output-available" && output) {
          if (toolName === "editDocument") {
            const editOutput = output as EditDocumentOutput;
            const originalContent = getOriginalContent(
              editorContext,
              editOutput.targetId,
              editOutput.action,
            );

            newPendingEdits.set(toolCallId, {
              toolCallId,
              action: editOutput.action,
              targetId: editOutput.targetId,
              newContent: editOutput.newContent,
              originalContent,
              explanation: editOutput.explanation || "",
            });
          }

          if (toolName === "batchEdit") {
            const batchOutput = output as BatchEditOutput;
            const edits = batchOutput.edits;
            if (edits && edits.length > 0) {
              const firstEdit = edits[0];
              const originalContent = getOriginalContent(
                editorContext,
                firstEdit.targetId,
                firstEdit.action,
              );

              newPendingEdits.set(toolCallId, {
                toolCallId,
                action: "batch",
                targetId: "multiple",
                explanation: batchOutput.explanation || "批量修改文档内容",
                originalContent,
              });
            }
          }

          if (toolName === "draftContent") {
            const draftOutput = output as DraftContentOutput;
            newPendingEdits.set(toolCallId, {
              toolCallId,
              action: "draft",
              targetId: "new",
              newContent: draftOutput.content,
              explanation: draftOutput.explanation || "为您生成了新的草稿",
            });
          }
        }
      }
    }

    setPendingEdits(newPendingEdits);
  }, [messages, editorContext, appliedEdits, getOriginalContent]);

  function getOriginalContent(
    ctx: NonNullable<typeof editorContext>,
    targetId: string,
    action: string,
  ): string {
    if (action === "replace_all") {
      return ctx.getDocumentContent() || "";
    }
    const structure = ctx.getDocumentStructure();
    const block = structure?.blocks.find((b: { id: string }) => b.id === targetId);
    return block?.content || "";
  }

  const handleApplyEdit = useCallback(
    (edit: PendingEdit) => {
      if (!editorContext) return;

      const command: EditCommand = {
        action: edit.action as EditCommand["action"],
        targetId: edit.targetId,
        newContent: edit.newContent,
        explanation: edit.explanation,
      };

      editorContext.applyEdits([command]);
      setAppliedEdits((prev) => new Set(prev).add(edit.toolCallId));
    },
    [editorContext],
  );

  const handleDiscardEdit = useCallback((toolCallId: string) => {
    setAppliedEdits((prev) => new Set(prev).add(toolCallId));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");

    let explicitIntent: "CHAT" | "EDITOR" | "SEARCH" = "CHAT";
    if (webSearchEnabled) {
      explicitIntent = "SEARCH";
    } else if (editMode) {
      explicitIntent = "EDITOR";
    }

    await sendMessage(
      { text },
      {
        body: {
          explicitIntent,
        },
      },
    );
  };

  const _insertToEditor = (text: string) => {
    if (!editorContext?.editor) return;
    editorContext.editor.chain().focus().insertContent(text).run();
  };

  const _copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_err) {}
  };

  const renderToolOutput = (toolName: string, output: unknown, toolCallId: string) => {
    if (!output) return null;

    switch (toolName) {
      case "createFlashcards": {
        const res = output as FlashcardOutput;
        return res.success && res.cards ? (
          <FlashcardCreated count={res.count} cards={res.cards} />
        ) : null;
      }

      case "searchNotes": {
        const res = output as SearchNotesOutput;
        return <SearchResults query={res.query || ""} results={res.results || []} />;
      }

      case "getReviewStats": {
        const res = output as ReviewStatsOutput;
        return (
          <ReviewStats
            totalCards={res.totalCards ?? 0}
            dueToday={res.dueToday ?? 0}
            newCards={res.newCards ?? 0}
            learningCards={res.learningCards ?? 0}
            masteredCards={res.masteredCards ?? 0}
            retention={res.retention ?? 0}
            streak={res.streak ?? 0}
          />
        );
      }

      case "createLearningPlan": {
        const res = output as LearningPlanOutput;
        return (
          <LearningPlan
            topic={res.topic ?? ""}
            duration={res.duration ?? ""}
            level={res.level ?? "beginner"}
          />
        );
      }

      case "editDocument":
      case "batchEdit":
      case "draftContent": {
        const edit = pendingEdits.get(toolCallId);
        if (!edit) return null;
        return (
          <EditConfirmCard
            action={edit.action}
            targetId={edit.targetId}
            newContent={edit.newContent}
            originalContent={edit.originalContent}
            explanation={edit.explanation}
            onApply={() => handleApplyEdit(edit)}
            onDiscard={() => handleDiscardEdit(toolCallId)}
          />
        );
      }

      case "generateQuiz": {
        const res = output as QuizOutput & {
          quiz?: { questions?: Question[] };
        };
        if (res.success && res.quiz) {
          const quiz = res.quiz;
          if (quiz.questions && quiz.questions.length > 0) {
            return (
              <QuizResult
                topic={quiz.topic}
                difficulty={quiz.difficulty}
                questions={quiz.questions}
              />
            );
          }
          return (
            <div className="glass glass-lg p-3 rounded-2xl border-l-4 border-primary/50">
              <p className="text-xs font-semibold text-primary">📝 生成测验：{quiz.topic}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {quiz.questionCount} 道 ·{" "}
                {quiz.difficulty === "easy" ? "简单" : quiz.difficulty === "hard" ? "困难" : "中等"}
              </p>
            </div>
          );
        }
        return null;
      }

      case "mindMap": {
        const res = output as MindMapOutput & {
          mindMap?: { nodes?: MindMapNode[] };
        };
        if (res.success && res.mindMap) {
          const mm = res.mindMap;
          if (mm.nodes && mm.nodes.length > 0) {
            return <MindMapView topic={mm.topic} nodes={mm.nodes} layout={mm.layout} />;
          }
          return (
            <div className="glass glass-lg p-3 rounded-2xl border-l-4 border-primary/50">
              <p className="text-xs font-semibold text-primary">🧠 思维导图：{mm.topic}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                最大 {mm.maxDepth} 层 ·{" "}
                {mm.layout === "tree" ? "树状" : mm.layout === "radial" ? "径向" : "思维导图"} 布局
              </p>
            </div>
          );
        }
        return null;
      }

      case "summarize": {
        const res = output as SummarizeOutput & {
          summary?: { content?: string; length?: string };
        };
        if (res.success && res.summary) {
          const s = res.summary;
          if (s.content && s.length) {
            return (
              <SummaryResult
                content={s.content}
                sourceLength={s.sourceLength}
                style={s.style}
                length={s.length}
              />
            );
          }
          return (
            <div className="glass glass-lg p-3 rounded-2xl border-l-4 border-primary/50">
              <p className="text-xs font-semibold text-primary">📄 生成摘要中...</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                目标 {s.targetLength} 字 ·{" "}
                {s.style === "bullet_points"
                  ? "要点列表"
                  : s.style === "paragraph"
                    ? "段落"
                    : "核心要点"}
              </p>
            </div>
          );
        }
        return null;
      }

      case "searchWeb": {
        const res = output as WebSearchOutput;
        if (res.success) {
          return (
            <WebSearchResult
              query={res.query}
              answer={res.answer}
              results={res.results || []}
              searchDepth={res.searchDepth || "basic"}
            />
          );
        }
        return (
          <div className="glass glass-lg p-3 rounded-2xl border-l-4 border-destructive/50">
            <p className="text-xs text-destructive">🔍 搜索失败：{res.message || "未知错误"}</p>
          </div>
        );
      }
    }

    return null;
  };

  const renderToolLoading = (toolName: string, _toolCallId: string) => {
    switch (toolName) {
      case "generateQuiz":
        return <QuizSkeleton questionCount={5} />;
      case "mindMap":
        return <MindMapSkeleton maxDepth={3} />;
      case "summarize":
        return <SummarySkeleton style="bullet_points" length="medium" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-transparent"
      role="region"
      aria-label="AI 聊天面板"
    >
      <div
        className="flex px-4 xs:px-6 md:px-8 pt-6 xs:pt-8 gap-2 xs:gap-3 flex-shrink-0 mb-4 xs:mb-6"
        role="tablist"
        aria-label="聊天模式选择"
      >
        {(["chat", "knowledge"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            role="tab"
            aria-selected={mode === m}
            aria-controls={`${m}-panel`}
            className={`flex-1 flex items-center justify-center gap-2 xs:gap-3 py-3 xs:py-4 rounded-[20px] xs:rounded-[24px] text-[10px] xs:text-[11px] font-black uppercase tracking-widest transition-all duration-500 relative overflow-hidden group touch-safe min-h-[44px] ${
              mode === m
                ? "bg-surface text-foreground shadow-float"
                : "text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-surface/50"
            }`}
          >
            {m === "chat" && (
              <MessageSquare
                className={`w-3.5 h-3.5 xs:w-4 xs:h-4 transition-transform duration-500 ${
                  mode === m ? "scale-110" : "group-hover:scale-110"
                }`}
              />
            )}
            {m === "knowledge" && (
              <Lightbulb
                className={`w-3.5 h-3.5 xs:w-4 xs:h-4 transition-transform duration-500 ${
                  mode === m ? "scale-110" : "group-hover:scale-110"
                }`}
              />
            )}
            <span className="relative z-10 hidden xs:inline">
              {m === "chat" ? "智能对话" : "原子知识"}
            </span>
            <span className="relative z-10 xs:hidden">{m === "chat" ? "对话" : "知识"}</span>

            {mode === m && (
              <motion.div
                layoutId="active-sidebar-tab"
                className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/[0.02] z-[-1]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {mode === "knowledge" && <KnowledgePanel />}
        {mode === "chat" && (
          <>
            <div
              className="mx-4 xs:mx-6 md:mx-8 mb-4 xs:mb-6 p-1 rounded-[24px] xs:rounded-[32px] bg-surface/50 border border-border/50 grid grid-cols-2 gap-1"
              role="group"
              aria-label="上下文控制"
            >
              {[
                {
                  id: "doc",
                  label: "当前文档",
                  icon: FileText,
                  active: useDocContext,
                  onClick: () => setUseDocContext(!useDocContext),
                },
                {
                  id: "edit",
                  label: "协作修改",
                  icon: Pencil,
                  active: editMode && useDocContext,
                  disabled: !useDocContext,
                  onClick: () => setEditMode(!editMode),
                },
                {
                  id: "rag",
                  label: "知识关联",
                  icon: BookOpen,
                  active: enableRAG,
                  onClick: () => setEnableRAG(!enableRAG),
                },
                {
                  id: "web",
                  label: "联网搜索",
                  icon: Globe,
                  active: webSearchEnabled,
                  onClick: toggleWebSearch,
                },
              ].map((control) => (
                <button
                  key={control.id}
                  onClick={control.onClick}
                  disabled={control.disabled}
                  aria-label={control.label}
                  aria-pressed={control.active}
                  className={`flex flex-col items-center justify-center p-3 xs:p-4 rounded-[20px] xs:rounded-[28px] transition-all duration-500 relative group touch-safe min-h-[44px] ${
                    control.active
                      ? "bg-surface shadow-float text-foreground"
                      : "text-muted-foreground/30 hover:text-muted-foreground/50"
                  } ${control.disabled ? "opacity-20 grayscale cursor-not-allowed" : ""}`}
                >
                  <control.icon
                    className={`w-3.5 h-3.5 xs:w-4 xs:h-4 mb-1 xs:mb-2 transition-transform duration-500 ${
                      control.active ? "scale-110" : "group-hover:scale-110"
                    }`}
                  />
                  <span className="text-[8px] xs:text-[9px] font-black uppercase tracking-widest leading-none">
                    {control.label}
                  </span>
                  {control.active && (
                    <motion.div
                      layoutId="active-control-dot"
                      className="absolute top-2 xs:top-3 right-2 xs:right-3 w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </button>
              ))}
            </div>

            <UnifiedChatUI
              messages={messages}
              isLoading={isLoading}
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              onStop={stop}
              variant="chat"
              placeholder="与您的笔记深度对话..."
              renderToolOutput={renderToolOutput}
              renderToolLoading={renderToolLoading}
              renderMessage={(message, _text, isUser) => {
                const content = getMessageContent(message);

                if (isUser) {
                  return (
                    <div className="flex justify-end mb-4">
                      <div className="max-w-[85%] bg-surface rounded-2xl px-4 py-2 text-sm text-foreground shadow-glass">
                        {content}
                      </div>
                    </div>
                  );
                }

                const toolCalls = getToolCalls(message);
                const hasPendingEdit = toolCalls.some(
                  (t) =>
                    (t.toolName === "editDocument" ||
                      t.toolName === "batchEdit" ||
                      t.toolName === "draftContent") &&
                    pendingEdits.has(t.toolCallId),
                );

                return (
                  <div className="mb-4" role="article">
                    <div className="flex items-start gap-2 mb-1">
                      <div
                        className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">
                        Assistant
                      </div>
                    </div>
                    <div className="pl-8">
                      {!hasPendingEdit && (
                        <div className="text-sm text-foreground/80 leading-relaxed prose prose-sm max-w-none">
                          {content || (isLoading ? "正在深思熟虑..." : "")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
              renderEmpty={() => (
                <div
                  className="h-full flex flex-col items-center justify-center text-center px-6 xs:px-12 opacity-40"
                  role="status"
                  aria-live="polite"
                >
                  <div
                    className="w-16 xs:w-20 md:w-24 h-16 xs:h-20 md:h-24 rounded-[32px] xs:rounded-[40px] bg-gradient-to-br from-primary/10 to-primary/[0.02] flex items-center justify-center mb-6 xs:mb-8 relative"
                    aria-hidden="true"
                  >
                    <Ghost className="w-8 h-8 xs:w-10 xs:h-10 text-primary animate-pulse" />
                    <div className="absolute inset-0 rounded-[32px] xs:rounded-[40px] border border-border/20 animate-ping [animation-duration:3s]" />
                  </div>
                  <h3 className="text-sm xs:text-base md:text-lg font-black text-foreground tracking-tight mb-2">
                    准备好深度内化了吗？
                  </h3>
                  <p className="text-[10px] xs:text-xs font-medium leading-relaxed text-muted-foreground">
                    我可以帮您总结要点、提取知识原子，或者针对当前内容进行辩论。
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full mt-6 xs:mt-8" role="list">
                    {[
                      "总结当前章节核心逻辑",
                      "基于此内容生成 3 个自测题",
                      "这段话的底层原理是什么？",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="px-3 xs:px-4 py-3 xs:py-4 rounded-2xl bg-surface/50 hover:bg-primary hover:text-primary-foreground transition-all text-[9px] xs:text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 touch-safe min-h-[44px]"
                        aria-label={`发送问题：${q}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}

function _Switch({
  active,
  onClick,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-5 rounded-full transition-all duration-500 p-0.5 relative flex items-center touch-safe min-h-[20px] ${active ? "bg-primary" : "bg-muted"} ${disabled ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
    >
      <motion.div
        animate={{ x: active ? 16 : 0 }}
        className="w-4 h-4 rounded-full bg-surface shadow-sm"
      />
    </button>
  );
}

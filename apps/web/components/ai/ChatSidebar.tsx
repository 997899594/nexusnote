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
import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { ChatAgentMessage } from "@/lib/ai/agents/chat-agent";
import type { MindMapNode, Question } from "@/lib/ai/tools/chat/learning";
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
} from "@/lib/ai/tools/types";
import { getMessageContent, getToolCalls } from "@/lib/ai/ui-utils";
import type { EditCommand } from "@/lib/editor/document-parser";
import { useEditor, useNoteExtractionOptional, useWebSearchToggle } from "@/lib/store";
import { KnowledgePanel } from "./KnowledgePanel";
import { UnifiedChatUI } from "./UnifiedChatUI";
// Generative UI Components
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

// 待确认的编辑操作
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

  // SDK v6: 使用 ChatAgentMessage 泛型实现 typed tool parts
  const { messages, sendMessage, status, stop } = useChat<ChatAgentMessage>({
    id: "chat-sidebar",
  });

  const isLoading = status === "streaming" || status === "submitted";

  // 处理编辑工具调用 - 从 typed tool parts 提取待确认的编辑
  useEffect(() => {
    if (!editorContext) return;

    const newPendingEdits = new Map<string, PendingEdit>();

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      // 架构师优化：使用统一的工具调用提取逻辑（类型安全）
      const toolCalls = getToolCalls(message);
      for (const tool of toolCalls) {
        const { toolName, output, toolCallId, state } = tool;

        if (toolName !== "editDocument" && toolName !== "batchEdit" && toolName !== "draftContent")
          continue;

        if (appliedEdits.has(toolCallId)) continue;

        // output-available = 工具执行完成
        if (state === "output-available" && output) {
          // 单个编辑
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

          // 批量编辑
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
                originalContent, // 保存第一个编辑的原始内容用于展示
              });
            }
          }

          // 草稿生成
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
    // 直接插入纯文本或简单的Markdown，不使用legacy convert
    editorContext.editor.chain().focus().insertContent(text).run();
  };

  const _copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_err) {}
  };

  // 渲染工具输出结果 UI
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
          // 如果有实际的题目数据，使用 QuizResult 组件
          if (quiz.questions && quiz.questions.length > 0) {
            return (
              <QuizResult
                topic={quiz.topic}
                difficulty={quiz.difficulty}
                questions={quiz.questions}
              />
            );
          }
          // 否则显示简化版本（保持向后兼容）
          return (
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                📝 生成测验：{quiz.topic}
              </p>
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
          // 如果有实际的节点数据，使用 MindMapView 组件
          if (mm.nodes && mm.nodes.length > 0) {
            return <MindMapView topic={mm.topic} nodes={mm.nodes} layout={mm.layout} />;
          }
          // 否则显示简化版本（保持向后兼容）
          return (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                🧠 思维导图：{mm.topic}
              </p>
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
          // 如果有实际的摘要内容，使用 SummaryResult 组件
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
          // 否则显示简化版本
          return (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                📄 生成摘要中...
              </p>
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
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">
              🔍 搜索失败：{res.message || "未知错误"}
            </p>
          </div>
        );
      }
    }

    return null;
  };

  // 渲染工具加载状态 UI（骨架屏）
  const renderToolLoading = (toolName: string, _toolCallId: string) => {
    switch (toolName) {
      case "generateQuiz":
        return <QuizSkeleton questionCount={5} />;
      case "mindMap":
        return <MindMapSkeleton maxDepth={3} />;
      case "summarize":
        return <SummarySkeleton style="bullet_points" length="medium" />;
      default:
        return null; // 使用默认加载指示器
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Mode Tabs */}
      <div className="flex px-8 pt-8 gap-3 flex-shrink-0 mb-6">
        {(["chat", "knowledge"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all duration-500 relative overflow-hidden group ${
              mode === m
                ? "text-black bg-white shadow-2xl shadow-black/5"
                : "text-black/20 hover:text-black/40 hover:bg-black/[0.02]"
            }`}
          >
            {m === "chat" && (
              <MessageSquare
                className={`w-4 h-4 transition-transform duration-500 ${
                  mode === m ? "scale-110" : "group-hover:scale-110"
                }`}
              />
            )}
            {m === "knowledge" && (
              <Lightbulb
                className={`w-4 h-4 transition-transform duration-500 ${
                  mode === m ? "scale-110" : "group-hover:scale-110"
                }`}
              />
            )}
            <span className="relative z-10">{m === "chat" ? "智能对话" : "原子知识"}</span>

            {mode === m && (
              <motion.div
                layoutId="active-sidebar-tab"
                className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.02] to-emerald-500/[0.02] z-[-1]"
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
            {/* Context Control - Premium Glass Tile */}
            <div className="mx-8 mb-6 p-1 rounded-[32px] bg-black/[0.02] border border-black/[0.03] grid grid-cols-2 gap-1">
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
                  className={`flex flex-col items-center justify-center p-4 rounded-[28px] transition-all duration-500 relative group ${
                    control.active
                      ? "bg-white shadow-xl shadow-black/[0.02] text-black"
                      : "text-black/20 hover:text-black/40"
                  } ${control.disabled ? "opacity-20 grayscale cursor-not-allowed" : ""}`}
                >
                  <control.icon
                    className={`w-4 h-4 mb-2 transition-transform duration-500 ${
                      control.active ? "scale-110" : "group-hover:scale-110"
                    }`}
                  />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                    {control.label}
                  </span>
                  {control.active && (
                    <motion.div
                      layoutId="active-control-dot"
                      className="absolute top-3 right-3 w-1 h-1 rounded-full bg-emerald-500"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Unified Chat UI */}
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
                // 使用架构师标准提取消息文本，处理多模态和 Schema-First 输出
                const content = getMessageContent(message);

                if (isUser) {
                  return (
                    <div className="flex justify-end mb-4">
                      <div className="max-w-[85%] bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-2 text-sm text-neutral-800 dark:text-neutral-200">
                        {content}
                      </div>
                    </div>
                  );
                }

                // 架构师优化：检查是否有待处理的编辑
                const toolCalls = getToolCalls(message);
                const hasPendingEdit = toolCalls.some(
                  (t) =>
                    (t.toolName === "editDocument" ||
                      t.toolName === "batchEdit" ||
                      t.toolName === "draftContent") &&
                    pendingEdits.has(t.toolCallId),
                );

                return (
                  <div className="mb-4">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <div className="text-[11px] font-medium text-neutral-400 mt-1 uppercase tracking-wider">
                        Assistant
                      </div>
                    </div>
                    <div className="pl-8">
                      {/* 如果有待确认的编辑，不重复渲染文本内容，由 renderToolOutput 接管渲染确认卡片 */}
                      {!hasPendingEdit && (
                        <div className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                          {content || (isLoading ? "正在深思熟虑..." : "")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
              renderEmpty={() => (
                <div className="h-full flex flex-col items-center justify-center text-center px-12 opacity-30">
                  <div className="w-24 h-24 rounded-[40px] bg-gradient-to-br from-violet-500/10 to-emerald-500/10 flex items-center justify-center mb-8 relative">
                    <Ghost className="w-10 h-10 text-violet-500 animate-pulse" />
                    <div className="absolute inset-0 rounded-[40px] border border-black/5 animate-ping [animation-duration:3s]" />
                  </div>
                  <h3 className="text-lg font-black text-black tracking-tight mb-2">
                    准备好深度内化了吗？
                  </h3>
                  <p className="text-xs font-medium leading-relaxed">
                    我可以帮您总结要点、提取知识原子，或者针对当前内容进行辩论。
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full mt-8">
                    {[
                      "总结当前章节核心逻辑",
                      "基于此内容生成 3 个自测题",
                      "这段话的底层原理是什么？",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="px-4 py-3 rounded-2xl bg-black/5 hover:bg-black hover:text-white transition-all text-[10px] font-black uppercase tracking-widest text-black/40"
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
      className={`w-9 h-5 rounded-full transition-all duration-500 p-0.5 relative flex items-center ${active ? "bg-violet-600" : "bg-black/10 dark:bg-white/10"} ${disabled ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
    >
      <motion.div
        animate={{ x: active ? 16 : 0 }}
        className="w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

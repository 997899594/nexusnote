"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  getToolName,
  isTextUIPart,
} from "ai";
import { useState, FormEvent, useMemo, useCallback, useEffect } from "react";
import {
  BookOpen,
  FileText,
  Pencil,
  Copy,
  FileDown,
  MessageSquare,
  Lightbulb,
  Ghost,
  Globe,
  User,
  Bot,
  Sparkles,
  Check,
} from "lucide-react";
import { useEditorContext } from "@/contexts/EditorContext";
import { useNoteExtractionOptional } from "@/contexts/NoteExtractionContext";
import { KnowledgePanel } from "./KnowledgePanel";
import { UnifiedChatUI } from "./UnifiedChatUI";
import type { EditCommand } from "@/lib/editor/document-parser";
import { motion } from "framer-motion";
import type { ChatAgentMessage } from "@/lib/ai/agents/chat-agent";
// Generative UI Components
import {
  FlashcardCreated,
  SearchResults,
  ReviewStats,
  LearningPlan,
  EditConfirmCard,
  EditThinking,
  QuizResult,
  MindMapView,
  SummaryResult,
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
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [useDocContext, setUseDocContext] = useState(true);
  const [editMode, setEditMode] = useState(true);
  const [input, setInput] = useState("");
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(
    new Map(),
  );
  const [appliedEdits, setAppliedEdits] = useState<Set<string>>(new Set());
  const [extractedNotes, setExtractedNotes] = useState<Set<string>>(new Set());
  const editorContext = useEditorContext();
  const noteExtraction = useNoteExtractionOptional();

  const chatTransport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai" }),
    [],
  );

  // SDK v6: 使用 ChatAgentMessage 泛型实现 typed tool parts
  const { messages, status, stop, sendMessage } = useChat<ChatAgentMessage>({
    id: "chat-sidebar",
    transport: chatTransport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // 处理编辑工具调用 - 从 typed tool parts 提取待确认的编辑
  useEffect(() => {
    if (!editorContext) return;

    const newPendingEdits = new Map<string, PendingEdit>();

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;

        const toolName = getToolName(part);
        if (
          toolName !== "editDocument" &&
          toolName !== "batchEdit" &&
          toolName !== "draftContent"
        )
          continue;

        const toolCallId = part.toolCallId;
        if (appliedEdits.has(toolCallId)) continue;

        // output-available = 工具执行完成
        if (part.state === "output-available" && part.output) {
          const output = part.output as Record<string, unknown>;

          // 单个编辑
          if (output.action && output.targetId) {
            const originalContent = getOriginalContent(
              editorContext,
              output.targetId as string,
              output.action as string,
            );

            newPendingEdits.set(toolCallId, {
              toolCallId,
              action: output.action as string,
              targetId: output.targetId as string,
              newContent: output.newContent as string | undefined,
              originalContent,
              explanation: (output.explanation as string) || "",
            });
          }

          // 批量编辑
          if (toolName === "batchEdit") {
            const edits = output.edits as
              | Array<{ action: string; targetId: string; newContent?: string }>
              | undefined;
            if (edits && edits.length > 0) {
              const firstEdit = edits[0];
              const originalContent = getOriginalContent(
                editorContext,
                firstEdit.targetId,
                firstEdit.action,
              );

              newPendingEdits.set(toolCallId, {
                toolCallId,
                action: firstEdit.action,
                targetId: firstEdit.targetId,
                newContent: firstEdit.newContent,
                originalContent,
                explanation:
                  (output.explanation as string) ||
                  `批量编辑 (${edits.length} 处)`,
              });
            }
          }

          // 草稿生成
          if (toolName === "draftContent") {
            newPendingEdits.set(toolCallId, {
              toolCallId,
              action: "insert_after",
              targetId: (output.targetId as string) || "end-of-document",
              newContent: output.content as string,
              originalContent: "",
              explanation: (output.explanation as string) || "生成草稿",
            });
          }
        }
      }
    }

    setPendingEdits(newPendingEdits);
  }, [messages, editorContext, appliedEdits]);

  function getOriginalContent(
    ctx: NonNullable<typeof editorContext>,
    targetId: string,
    action: string,
  ): string {
    if (action === "replace_all") {
      return ctx.getDocumentContent() || "";
    }
    const structure = ctx.getDocumentStructure();
    const block = structure?.blocks.find(
      (b: { id: string }) => b.id === targetId,
    );
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

    await sendMessage(
      { text },
      {
        body: {
          enableRAG,
          enableWebSearch,
          enableTools: true,
          documentContext: useDocContext
            ? editorContext?.getDocumentContent()
            : undefined,
          documentStructure: editMode
            ? JSON.stringify(editorContext?.getDocumentStructure())
            : undefined,
          editMode,
        },
      },
    );
  };

  const getMessageText = (message: (typeof messages)[0]): string => {
    if (!message.parts || message.parts.length === 0) return "";
    return message.parts
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join("");
  };

  const insertToEditor = (text: string) => {
    if (!editorContext?.editor) return;
    // 直接插入纯文本或简单的Markdown，不使用legacy convert
    editorContext.editor.chain().focus().insertContent(text).run();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {}
  };

  // 渲染工具输出结果 UI
  const renderToolOutput = (
    toolName: string,
    output: unknown,
    toolCallId: string,
  ) => {
    const res = output as Record<string, unknown>;
    if (!res) return null;

    switch (toolName) {
      case "createFlashcards":
        return res.success && res.cards ? (
          <FlashcardCreated
            count={res.count as number}
            cards={
              res.cards as Array<{ id: string; front: string; back: string }>
            }
          />
        ) : null;

      case "searchNotes":
        return (
          <SearchResults
            query={(res.query as string) || ""}
            results={
              (res.results as Array<{
                title: string;
                content: string;
                documentId: string;
                relevance: number;
              }>) || []
            }
          />
        );

      case "getReviewStats":
        return (
          <ReviewStats
            totalCards={(res.totalCards as number) ?? 0}
            dueToday={(res.dueToday as number) ?? 0}
            newCards={(res.newCards as number) ?? 0}
            learningCards={(res.learningCards as number) ?? 0}
            masteredCards={(res.masteredCards as number) ?? 0}
            retention={(res.retention as number) ?? 0}
            streak={(res.streak as number) ?? 0}
          />
        );

      case "createLearningPlan":
        return (
          <LearningPlan
            topic={(res.topic as string) ?? ""}
            duration={(res.duration as string) ?? ""}
            level={
              (res.level as "beginner" | "intermediate" | "advanced") ??
              "beginner"
            }
          />
        );

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

      case "generateQuiz":
        // Quiz 工具：渲染测验元信息卡片
        if (res.success && res.quiz) {
          const quiz = res.quiz as {
            topic: string;
            difficulty: string;
            questionCount: number;
          };
          return (
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                📝 生成测验：{quiz.topic}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {quiz.questionCount} 道 ·{" "}
                {quiz.difficulty === "easy"
                  ? "简单"
                  : quiz.difficulty === "hard"
                    ? "困难"
                    : "中等"}
              </p>
            </div>
          );
        }
        return null;

      case "mindMap":
        // MindMap 工具：渲染思维导图元信息
        if (res.success && res.mindMap) {
          const mm = res.mindMap as {
            topic: string;
            maxDepth: number;
            layout: string;
          };
          return (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                🧠 思维导图：{mm.topic}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                最大 {mm.maxDepth} 层 ·{" "}
                {mm.layout === "tree"
                  ? "树状"
                  : mm.layout === "radial"
                    ? "径向"
                    : "思维导图"}{" "}
                布局
              </p>
            </div>
          );
        }
        return null;

      case "summarize":
        // Summary 工具：渲染摘要配置
        if (res.success && res.summary) {
          const s = res.summary as { targetLength: string; style: string };
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

      case "searchWeb":
        // Web Search 工具：渲染搜索结果
        if (res.success) {
          return (
            <WebSearchResult
              query={res.query as string}
              answer={res.answer as string | undefined}
              results={
                (res.results as Array<{
                  title: string;
                  url: string;
                  content: string;
                  score?: number;
                  publishedDate?: string;
                }>) || []
              }
              searchDepth={(res.searchDepth as "basic" | "advanced") || "basic"}
            />
          );
        }
        return (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">
              🔍 搜索失败：{(res.message as string) || "未知错误"}
            </p>
          </div>
        );
    }

    return null;
  };

  // 渲染 typed tool part
  const renderToolPart = (part: (typeof messages)[0]["parts"][number]) => {
    if (!isToolUIPart(part)) return null;

    const toolName = getToolName(part);
    const toolCallId = part.toolCallId;

    // 已应用的编辑
    if (
      (toolName === "editDocument" || toolName === "batchEdit") &&
      appliedEdits.has(toolCallId)
    ) {
      return (
        <div
          key={toolCallId}
          className="text-xs text-muted-foreground italic py-2"
        >
          ✓ 编辑已应用
        </div>
      );
    }

    // input-streaming / input-available = 执行中
    if (part.state === "input-streaming" || part.state === "input-available") {
      if (toolName === "editDocument" || toolName === "batchEdit") {
        const input =
          "input" in part && part.state === "input-available"
            ? part.input
            : undefined;
        return (
          <EditThinking
            key={toolCallId}
            action={(input as { action?: string })?.action}
          />
        );
      }
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

    // output-available = 完成
    if (part.state === "output-available") {
      return (
        <div key={toolCallId} className="mt-3">
          {renderToolOutput(toolName, part.output, toolCallId)}
        </div>
      );
    }

    // output-error
    if (part.state === "output-error") {
      return (
        <div key={toolCallId} className="text-xs text-red-500 py-2">
          {toolName} 执行失败: {part.errorText || "未知错误"}
        </div>
      );
    }

    return null;
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
            <span className="relative z-10">
              {m === "chat" ? "智能对话" : "原子知识"}
            </span>

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
                  active: enableWebSearch,
                  onClick: () => setEnableWebSearch(!enableWebSearch),
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
              renderMessage={(message, text, isUser) => {
                if (isUser) {
                  return (
                    <div className="flex flex-col items-end px-8">
                      <div className="flex gap-4 max-w-[95%] flex-row-reverse">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-black text-white shadow-lg shadow-black/10">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="rounded-[28px] rounded-tr-sm px-5 py-4 text-sm leading-relaxed shadow-xl shadow-black/[0.02] bg-black text-white font-medium">
                            <p className="whitespace-pre-wrap">{text}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isExtracted = extractedNotes.has(message.id);

                return (
                  <div className="flex flex-col items-start px-8">
                    <div className="flex gap-4 max-w-[95%]">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-violet-500 text-white shadow-lg shadow-violet-500/20">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="rounded-[28px] rounded-tl-sm px-6 py-5 text-sm leading-relaxed shadow-xl shadow-black/[0.02] bg-white border border-black/[0.03] text-black/80 font-medium relative group/msg">
                          <p className="whitespace-pre-wrap">
                            {text || (isLoading ? "正在深思熟虑..." : "")}
                          </p>

                          {text && (
                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/[0.03]">
                              <button
                                onClick={() => copyToClipboard(text)}
                                className="p-2 rounded-xl hover:bg-black/5 text-black/20 hover:text-black transition-all"
                                title="复制内容"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  if (noteExtraction && !isExtracted) {
                                    noteExtraction.extractNote(
                                      text,
                                      new DOMRect(),
                                      {
                                        sourceType: "learning",
                                        position: { from: 0, to: 0 },
                                      },
                                    );
                                    setExtractedNotes((prev) =>
                                      new Set(prev).add(message.id),
                                    );
                                  }
                                }}
                                disabled={isExtracted || !noteExtraction}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                                  isExtracted
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "hover:bg-violet-50 text-black/20 hover:text-violet-600"
                                }`}
                                title={
                                  isExtracted
                                    ? "已存入原子知识"
                                    : "存为原子知识"
                                }
                              >
                                {isExtracted ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                      已存入
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                      存为知识
                                    </span>
                                  </>
                                )}
                              </button>

                              {editorContext && (
                                <button
                                  onClick={() => insertToEditor(text)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-black/5 text-black/20 hover:text-black transition-all"
                                  title="插入到编辑器"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase tracking-wider">
                                    插入文档
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
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

function Switch({
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

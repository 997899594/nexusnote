"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import {
  useRef,
  useEffect,
  useState,
  FormEvent,
  useMemo,
  useCallback,
} from "react";
import {
  Send,
  Square,
  User,
  Bot,
  BookOpen,
  FileText,
  Pencil,
  Copy,
  FileDown,
  MessageSquare,
  Lightbulb,
  Ghost,
  Globe,
} from "lucide-react";
import { useEditorContext } from "@/contexts/EditorContext";
import { KnowledgePanel } from "./KnowledgePanel";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorContext = useEditorContext();

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const getMessageText = (message: (typeof messages)[0]) => {
    if (message.parts) {
      return message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
    }
    return (message as any).content || "";
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
          const quiz = res.quiz as { topic: string; difficulty: string; questionCount: number };
          return (
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                📝 生成测验：{quiz.topic}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {quiz.questionCount} 道 · {quiz.difficulty === 'easy' ? '简单' : quiz.difficulty === 'hard' ? '困难' : '中等'}
              </p>
            </div>
          );
        }
        return null;

      case "mindMap":
        // MindMap 工具：渲染思维导图元信息
        if (res.success && res.mindMap) {
          const mm = res.mindMap as { topic: string; maxDepth: number; layout: string };
          return (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                🧠 思维导图：{mm.topic}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                最大 {mm.maxDepth} 层 · {mm.layout === 'tree' ? '树状' : mm.layout === 'radial' ? '径向' : '思维导图'} 布局
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
                目标 {s.targetLength} 字 · {s.style === 'bullet_points' ? '要点列表' : s.style === 'paragraph' ? '段落' : '核心要点'}
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
              results={(res.results as Array<{
                title: string;
                url: string;
                content: string;
                score?: number;
                publishedDate?: string;
              }>) || []}
              searchDepth={(res.searchDepth as 'basic' | 'advanced') || 'basic'}
            />
          );
        }
        return (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">
              🔍 搜索失败：{res.message as string || '未知错误'}
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
      <div className="flex px-4 gap-1 flex-shrink-0 mb-2">
        {(["chat", "knowledge"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold tracking-tight transition-all duration-300 ${
              mode === m
                ? "bg-violet-500/10 text-violet-500 shadow-[inset_0_0_12px_rgba(139,92,246,0.1)]"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {m === "chat" && <MessageSquare className="w-3.5 h-3.5" />}
            {m === "knowledge" && <Lightbulb className="w-3.5 h-3.5" />}
            {m === "chat" ? "对话" : "知识库"}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {mode === "knowledge" && <KnowledgePanel />}
        {mode === "chat" && (
          <>
            {/* Context Control Glass Tile */}
            <div className="mx-4 mb-4 p-3 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span>启用当前文档</span>
                </div>
                <Switch
                  active={useDocContext}
                  onClick={() => setUseDocContext(!useDocContext)}
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <Pencil className="w-3 h-3" />
                  <span>启用协作修改</span>
                </div>
                <Switch
                  active={editMode && useDocContext}
                  disabled={!useDocContext}
                  onClick={() => setEditMode(!editMode)}
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <BookOpen className="w-3 h-3" />
                  <span>关联全局知识 (RAG)</span>
                </div>
                <Switch
                  active={enableRAG}
                  onClick={() => setEnableRAG(!enableRAG)}
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <Globe className="w-3 h-3" />
                  <span>联网搜索</span>
                </div>
                <Switch
                  active={enableWebSearch}
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                />
              </div>
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar pb-4 min-h-0">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-40">
                  <div className="w-16 h-16 rounded-[2rem] bg-violet-500/10 flex items-center justify-center mb-6">
                    <Ghost className="w-8 h-8 text-violet-500 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium">
                    随时提问，我会根据您的笔记提供答案
                  </p>
                  <p className="text-xs mt-2">试试："帮我总结当前的重点"</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`flex gap-3 max-w-[92%] ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${message.role === "assistant" ? "bg-violet-500/20 text-violet-500" : "bg-muted text-muted-foreground"}`}
                    >
                      {message.role === "assistant" ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          message.role === "user"
                            ? "bg-violet-600 text-white rounded-tr-sm"
                            : "bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 rounded-tl-sm"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <div>
                            <p className="whitespace-pre-wrap">
                              {getMessageText(message) ||
                                (isLoading ? "思考中..." : "")}
                            </p>
                            {getMessageText(message) && (
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-black/5 dark:border-white/5 opacity-50 hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() =>
                                    insertToEditor(getMessageText(message))
                                  }
                                  className="flex items-center gap-1 hover:text-violet-500"
                                >
                                  <FileDown className="w-3 h-3" /> 插入
                                </button>
                                <button
                                  onClick={() =>
                                    copyToClipboard(getMessageText(message))
                                  }
                                  className="flex items-center gap-1 hover:text-violet-500"
                                >
                                  <Copy className="w-3 h-3" /> 复制
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">
                            {getMessageText(message)}
                          </p>
                        )}
                      </div>

                      {/* Typed Tool Parts - SDK v6 Agent 模式 */}
                      {message.role === "assistant" && (
                        <div className="mt-2 space-y-2">
                          {message.parts
                            .filter((p) => isToolUIPart(p))
                            .map((part) => renderToolPart(part))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Sticky Input Bar */}
            <div className="p-4 border-t border-black/5 dark:border-white/5 backdrop-blur-3xl shrink-0">
              <form onSubmit={handleSubmit} className="relative group">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入指令..."
                  disabled={isLoading}
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[1.5rem] pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all placeholder:text-muted-foreground/50"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="w-9 h-9 flex items-center justify-center bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="w-9 h-9 flex items-center justify-center bg-violet-600 text-white rounded-full disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-violet-950/20 hover:scale-105 active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>
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

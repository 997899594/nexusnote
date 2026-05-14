"use client";

import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import {
  Globe,
  GraduationCap,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AIDegradationBanner, WorkspaceEmptyState } from "@/components/common";
import { useInputProtection } from "@/components/common/useInputProtection";
import type { ResearchRunSnapshot, ResearchRunStatus } from "@/lib/ai/research/contracts";
import { parseBackgroundResearchMetadata } from "@/lib/ai/research/contracts";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import type { Command } from "@/types/chat";
import { ChatMessage, LoadingDots } from "./ChatMessage";
import { CommandMenu } from "./CommandMenu";
import { StreamdownMessage } from "./StreamdownMessage";
import { useChatSession } from "./useChatSession";

interface ChatPanelProps {
  sessionId: string | null;
}

interface BackgroundResearchState {
  runId: string;
  status: ResearchRunStatus;
  progressMessage?: string;
  completedTasks?: number;
  totalTasks?: number;
  reportMarkdown?: string;
  failedReason?: string;
  citationCount?: number;
  canCancel?: boolean;
  canRetry?: boolean;
}

function buildBackgroundResearchState(snapshot: ResearchRunSnapshot): BackgroundResearchState {
  return {
    runId: snapshot.id,
    status: snapshot.status,
    progressMessage: snapshot.progress?.message,
    completedTasks: snapshot.progress?.completedTasks,
    totalTasks: snapshot.progress?.totalTasks,
    reportMarkdown: snapshot.report?.reportMarkdown,
    failedReason: snapshot.errorMessage ?? undefined,
    citationCount: snapshot.citations.length,
    canCancel: snapshot.canCancel,
    canRetry: snapshot.canRetry,
  };
}

const CHAT_COMMANDS: Command[] = [
  {
    id: "search",
    label: "Search Notes",
    icon: Search,
    modeLabel: "搜索笔记",
    modeIcon: Search,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ q: input.trim() }),
  },
  {
    id: "create-note",
    label: "Create Note",
    icon: Plus,
    modeLabel: "查看笔记",
    modeIcon: Plus,
    targetPath: "/editor",
    getQueryParams: () => ({}),
  },
  {
    id: "interview",
    label: "Interview Mode",
    icon: MessageCircle,
    modeLabel: "课程访谈",
    modeIcon: MessageCircle,
    targetPath: "/interview",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "generate-course",
    label: "Generate Course",
    icon: GraduationCap,
    modeLabel: "生成课程",
    modeIcon: GraduationCap,
    targetPath: "/interview",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "web-search",
    label: "Web Search",
    icon: Globe,
    modeLabel: "联网搜索",
    modeIcon: Globe,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ web: input.trim() }),
  },
];

function extractCommandContent(input: string): string {
  const match = input.match(/^\/\S+\s*(.*)$/);
  return match ? match[1] : "";
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSubmittedTextRef = useRef("");
  const previousSessionIdRef = useRef<string | null | undefined>(undefined);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [backgroundResearch, setBackgroundResearch] = useState<BackgroundResearchState | null>(
    null,
  );
  const didSendLaunchMessageRef = useRef(false);

  const launchMessage = searchParams.get("msg")?.trim() ?? "";
  const chatRequestBody = useMemo(() => {
    const context = searchParams.get("context");

    if (context === "career") {
      const selectedDirectionKey = searchParams.get("directionKey")?.trim() || undefined;

      return {
        metadata: {
          context: "career" as const,
          selectedDirectionKey,
        },
      };
    }

    return undefined;
  }, [searchParams]);

  const chat = useChatSession({
    sessionId,
    body: chatRequestBody,
  });

  const messages = chat.messages;
  const sendMessage = chat.sendMessage;
  const setChatMessages = chat.setMessages;
  const routeHint = chat.routeHint;
  const sessionMetadata = chat.sessionMetadata;
  const status = chat.status;
  const aiDegradedKind = chat.aiDegradedKind;
  // AI SDK v6: isLoading is derived from status
  const isLoading = status === "submitted" || status === "streaming";
  const { handlePaste } = useInputProtection();

  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  useEffect(() => {
    if (previousSessionIdRef.current === sessionId) {
      return;
    }

    previousSessionIdRef.current = sessionId;
    setBackgroundResearch(null);
  }, [sessionId]);

  useEffect(() => {
    if (chatMessages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, isLoading]);

  // 同步消息到 store，供索引使用
  const setCurrentSessionMessages = useChatStore((s) => s.setCurrentSessionMessages);
  useEffect(() => {
    setCurrentSessionMessages(chatMessages);
    return () => setCurrentSessionMessages(null);
  }, [chatMessages, setCurrentSessionMessages]);

  useEffect(() => {
    if (!sessionId || !launchMessage || didSendLaunchMessageRef.current) {
      return;
    }

    if (chatMessages.length > 0 || isLoading) {
      return;
    }

    didSendLaunchMessageRef.current = true;
    lastSubmittedTextRef.current = launchMessage;
    void sendMessage({ text: launchMessage }).finally(() => {
      router.replace(`/chat/${sessionId}`);
    });
  }, [chatMessages.length, isLoading, launchMessage, router, sendMessage, sessionId]);

  useEffect(() => {
    if (
      routeHint?.executionMode !== "redirect" ||
      routeHint.handoffTarget !== "course_interviewer"
    ) {
      return;
    }

    const message = lastSubmittedTextRef.current || launchMessage;
    const query = new URLSearchParams();

    if (message) {
      query.set("msg", message);
    }

    router.replace(query.size > 0 ? `/interview?${query.toString()}` : "/interview");
  }, [launchMessage, routeHint, router]);

  useEffect(() => {
    if (
      routeHint?.executionMode !== "workflow" ||
      routeHint.handoffTarget !== "research_assistant" ||
      routeHint.workflowJobType !== "run_background_research" ||
      !routeHint.workflowJobId
    ) {
      return;
    }

    setBackgroundResearch({
      runId: routeHint.workflowJobId,
      status: "queued",
    });
  }, [routeHint]);

  useEffect(() => {
    const resumedResearch = parseBackgroundResearchMetadata(sessionMetadata);
    if (!resumedResearch) {
      return;
    }

    setBackgroundResearch((current) => {
      if (
        current?.runId === resumedResearch.runId &&
        current.status !== "queued" &&
        current.status !== "cancel_requested"
      ) {
        return current;
      }

      return {
        runId: resumedResearch.runId,
        status: resumedResearch.state,
        failedReason: resumedResearch.failedReason,
      };
    });
  }, [sessionMetadata]);

  useEffect(() => {
    if (!backgroundResearch) {
      return;
    }

    if (
      backgroundResearch.status === "completed" ||
      backgroundResearch.status === "failed" ||
      backgroundResearch.status === "canceled"
    ) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const response = await fetch(`/api/research-jobs/${backgroundResearch.runId}`);
      if (!response.ok || cancelled) {
        return;
      }

      const snapshot = (await response.json()) as ResearchRunSnapshot;

      if (cancelled) {
        return;
      }

      setBackgroundResearch(buildBackgroundResearchState(snapshot));

      if (snapshot.status === "completed" && sessionId) {
        const sessionResponse = await fetch(`/api/chat-sessions/${sessionId}`);
        if (!sessionResponse.ok || cancelled) {
          return;
        }

        const data = (await sessionResponse.json()) as { session?: { messages?: UIMessage[] } };
        if (data.session?.messages) {
          setChatMessages(data.session.messages);
        }
        setBackgroundResearch(null);
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll().catch((error) => {
        console.error("[ChatPanel] background research poll failed", error);
      });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [backgroundResearch, sessionId, setChatMessages]);

  const handleResearchAction = async (action: "cancel" | "retry") => {
    if (!backgroundResearch) {
      return;
    }

    const response = await fetch(`/api/research-jobs/${backgroundResearch.runId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      console.error("[ChatPanel] failed to update research run", action, response.status);
      return;
    }

    const snapshot = (await response.json()) as ResearchRunSnapshot;
    setBackgroundResearch(buildBackgroundResearchState(snapshot));
  };

  const sendChatMessage = async (text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    lastSubmittedTextRef.current = trimmedText;
    await sendMessage({ text: trimmedText });
  };

  const filteredCommands = (() => {
    if (!input.startsWith("/")) return CHAT_COMMANDS;
    const query = input.slice(1).trim().toLowerCase();
    if (!query) return CHAT_COMMANDS;
    return CHAT_COMMANDS.filter((c) => c.label.toLowerCase().includes(query));
  })();

  useEffect(() => {
    if (selectedCommand) {
      setShowCommands(false);
    } else if (input.startsWith("/")) {
      setShowCommands(true);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [input, selectedCommand]);

  const handleSelectCommand = (command: Command) => {
    setInput(extractCommandContent(input));
    setSelectedCommand(command);
    setShowCommands(false);
  };

  const handleCancelCommand = () => {
    setSelectedCommand(null);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    if (selectedCommand) {
      const params = selectedCommand.getQueryParams(input);
      const queryString = new URLSearchParams(params).toString();
      const path = queryString
        ? `${selectedCommand.targetPath}?${queryString}`
        : selectedCommand.targetPath;
      router.push(path);
      setInput("");
      setSelectedCommand(null);
      setShowCommands(false);
      return;
    }

    if (input.startsWith("/") && filteredCommands.length > 0) {
      setInput(extractCommandContent(input));
      setSelectedCommand(filteredCommands[selectedIndex]);
      setShowCommands(false);
      return;
    }

    await sendChatMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedCommand) {
      if (e.key === "Escape") {
        handleCancelCommand();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
    }

    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === "Escape") {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const placeholder = selectedCommand
    ? `描述你想${selectedCommand.modeLabel}的内容...`
    : showCommands
      ? "搜索命令..."
      : "继续对话...";

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        选择或创建一个会话开始聊天
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mobile-scroll flex-1 overflow-y-auto bg-white px-4 pb-8 pt-5 safe-bottom md:px-6 md:pb-10 md:pt-6">
        <div className="mx-auto max-w-[calc(100vw-32px)] space-y-4 md:max-w-[var(--message-max-width)]">
          <AIDegradationBanner kind={aiDegradedKind} />

          {chatMessages.length === 0 && !isLoading && (
            <WorkspaceEmptyState
              icon={Sparkles}
              eyebrow="New Session"
              title="开始一段新对话"
              description="继续提问、保存想法，或进入课程、访谈与笔记工作流。"
              className="py-10"
            />
          )}

          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onSendReply={sendChatMessage} />
          ))}

          {backgroundResearch && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] shadow-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Loader2
                  className={cn(
                    "h-4 w-4",
                    backgroundResearch.status === "completed" ||
                      backgroundResearch.status === "failed" ||
                      backgroundResearch.status === "canceled"
                      ? "animate-none"
                      : "animate-spin",
                  )}
                />
                {backgroundResearch.status === "completed"
                  ? "后台研究已完成"
                  : backgroundResearch.status === "failed"
                    ? "后台研究失败"
                    : backgroundResearch.status === "canceled"
                      ? "后台研究已取消"
                      : backgroundResearch.status === "cancel_requested"
                        ? "后台研究取消中"
                        : "后台研究进行中"}
              </div>

              {backgroundResearch.totalTasks != null && (
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                  {backgroundResearch.completedTasks ?? 0}/{backgroundResearch.totalTasks}{" "}
                  个子任务已完成
                </p>
              )}

              {backgroundResearch.status !== "completed" &&
                backgroundResearch.status !== "failed" &&
                backgroundResearch.status !== "canceled" && (
                  <p className="text-[var(--color-text-secondary)]">
                    {backgroundResearch.progressMessage ??
                      "正在拆分并行研究任务、检索来源并综合结果。你可以继续当前对话。"}
                  </p>
                )}

              {backgroundResearch.status === "failed" && (
                <p className="text-[var(--color-text-secondary)]">
                  {backgroundResearch.failedReason ?? "研究任务执行失败，请稍后再试。"}
                </p>
              )}

              {backgroundResearch.status === "canceled" && (
                <p className="text-[var(--color-text-secondary)]">
                  研究任务已停止，当前不会再继续生成结果。
                </p>
              )}

              {backgroundResearch.status === "completed" && sessionId && (
                <p className="text-[var(--color-text-secondary)]">研究结果已经写回当前对话。</p>
              )}

              {backgroundResearch.citationCount != null && backgroundResearch.citationCount > 0 && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  已归档 {backgroundResearch.citationCount} 个结构化来源引用。
                </p>
              )}

              {(backgroundResearch.canCancel || backgroundResearch.canRetry) && (
                <div className="mt-3 flex items-center gap-2">
                  {backgroundResearch.canCancel && (
                    <button
                      type="button"
                      onClick={() => void handleResearchAction("cancel")}
                      className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                    >
                      取消研究
                    </button>
                  )}
                  {backgroundResearch.canRetry && (
                    <button
                      type="button"
                      onClick={() => void handleResearchAction("retry")}
                      className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                    >
                      重试研究
                    </button>
                  )}
                </div>
              )}

              {backgroundResearch.status === "completed" &&
                !sessionId &&
                backgroundResearch.reportMarkdown && (
                  <div className="mt-3 rounded-xl bg-[var(--color-panel-soft)] px-3 py-3">
                    <StreamdownMessage content={backgroundResearch.reportMarkdown} />
                  </div>
                )}
            </div>
          )}

          {isAILoading && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-[var(--color-panel-soft)] px-4 pb-5 pt-4 safe-bottom md:px-6 md:pb-6 md:pt-4">
        <div className="relative mx-auto max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)]">
          <AnimatePresence>
            {showCommands && !selectedCommand && filteredCommands.length > 0 && (
              <CommandMenu
                commands={filteredCommands}
                selectedIndex={selectedIndex}
                onSelect={handleSelectCommand}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedCommand && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mb-3 flex items-center gap-2"
              >
                <div className="ui-badge-pill flex items-center gap-1.5 px-3 py-1.5 text-xs">
                  <selectedCommand.modeIcon className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span className="text-[var(--color-text-secondary)] font-medium">
                    {selectedCommand.modeLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelCommand}
                    className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="ui-input-shell flex items-end gap-2 rounded-[28px] p-2 md:gap-3 md:p-3">
            <div className="ui-icon-chip flex h-8 w-8 flex-shrink-0 items-center justify-center">
              <Sparkles className="h-4 w-4 text-[var(--color-text)]" />
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none min-h-[24px] max-h-[120px]"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                input.trim() && !isLoading
                  ? "ui-primary-button"
                  : "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]",
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

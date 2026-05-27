"use client";

import { getToolName, isDataUIPart, isToolUIPart, type UIMessage } from "ai";
import { ArrowLeft, CheckCircle2, Compass, Loader2, MessageCircle, Save, Send } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CareerMapPanel } from "@/components/career-planning/CareerMapPanel";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { useChatSession } from "@/components/chat/useChatSession";
import { AIDegradationBanner, PromptChip, WorkspaceEmptyState } from "@/components/common";
import { shouldSubmitOnEnter } from "@/components/common/keyboard";
import { useInputProtection } from "@/components/common/useInputProtection";
import { useIsMobile } from "@/hooks/useIsMobile";
import { type CareerMapDraft, careerMapDraftSchema } from "@/lib/ai/career-planning/schemas";
import type { CareerPlanningWorkspaceData } from "@/lib/career-planning/workspace-data";
import { cn } from "@/lib/utils";

interface CareerPlanningClientProps {
  data: CareerPlanningWorkspaceData;
}

type MobileCareerView = "chat" | "map";
type SaveState = "idle" | "saving" | "saved" | "error";
type CommitState = "idle" | "saving" | "saved" | "error";

function buildInitialDescription(data: CareerPlanningWorkspaceData): string {
  if (data.snapshot.status === "empty") {
    return "先生成或保存课程。之后我会从真实学习轨迹开始做职业访谈，而不是让你从零填写画像。";
  }

  if (data.snapshot.status === "pending") {
    return "课程信号正在整理。你可以先聊动机和约束，职业地图完成后会继续校准。";
  }

  if (!data.currentRoute) {
    return "我会先根据课程和学习证据提出方向假设，再用少量问题帮你校准。";
  }

  return `我先看到的主线是“${data.currentRoute.title}”。先不急着下结论，我们用一个问题确认它是不是真的适合你。`;
}

function getLatestCareerMapDraft(messages: UIMessage[]): CareerMapDraft | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex];
    if (message.role !== "assistant") {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex--) {
      const part = message.parts[partIndex];
      if (isDataUIPart(part) && part.type === "data-careerMapDraft") {
        const parsed = careerMapDraftSchema.safeParse(part.data);
        return parsed.success ? parsed.data : null;
      }

      if (
        !isToolUIPart(part) ||
        getToolName(part) !== "presentCareerMapDraft" ||
        (part.state !== "input-available" && part.state !== "output-available")
      ) {
        continue;
      }

      const parsed = careerMapDraftSchema.safeParse(part.input);
      return parsed.success ? parsed.data : null;
    }
  }

  return null;
}

export default function CareerPlanningClient({ data }: CareerPlanningClientProps) {
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [careerSessionId] = useState(() => data.planningState?.sessionId ?? crypto.randomUUID());
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(
    () => data.planningState?.selectedRouteKey ?? data.currentRoute?.directionKey ?? null,
  );
  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<MobileCareerView>("chat");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [commitState, setCommitState] = useState<CommitState>("idle");
  const { handlePaste } = useInputProtection();
  const chat = useChatSession({
    sessionId: careerSessionId,
    body: () => ({
      metadata: {
        context: "career" as const,
        entry: "planning" as const,
        selectedDirectionKey: selectedRouteKey ?? undefined,
      },
    }),
  });
  const messages = useMemo(
    () => chat.messages.filter((message: UIMessage) => message.role !== "system"),
    [chat.messages],
  );
  const streamedCareerMapDraft = useMemo(() => getLatestCareerMapDraft(messages), [messages]);
  const careerMapDraft = streamedCareerMapDraft ?? data.planningState?.mapDraft ?? null;
  const status = chat.status;
  const isLoading = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const isAILoading = isLoading && (!lastMessage || lastMessage.role === "user");
  const draftSelectedRoute =
    careerMapDraft?.routes.find((route) => route.directionKey === selectedRouteKey) ?? null;
  const activeRouteTitle =
    draftSelectedRoute?.title ??
    data.routes.find((route) => route.directionKey === selectedRouteKey)?.title ??
    data.planningState?.title ??
    data.currentRoute?.title ??
    "从课程信号开始建立方向";

  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (streamedCareerMapDraft) {
      setSaveState("idle");
      setCommitState("idle");
    }

    if (streamedCareerMapDraft?.selectedRouteKey) {
      setSelectedRouteKey(streamedCareerMapDraft.selectedRouteKey);
    }
  }, [streamedCareerMapDraft]);

  const sendCareerMessage = async (text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText || isLoading) {
      return;
    }

    await chat.sendMessage({ text: trimmedText });
  };

  const buildPersistPayload = (source: "manual_save" | "route_commit") => {
    const routeKey = selectedRouteKey ?? careerMapDraft?.selectedRouteKey ?? undefined;
    return {
      sessionId: careerSessionId,
      ...(messages.length > 0 ? { conversationId: careerSessionId } : {}),
      source,
      ...(routeKey ? { selectedRouteKey: routeKey } : {}),
      ...(careerMapDraft ? { mapDraft: careerMapDraft } : {}),
    };
  };

  const handleSaveCareerMap = async () => {
    setSaveState("saving");

    try {
      const response = await fetch("/api/career-planning/revisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPersistPayload("manual_save")),
      });

      if (!response.ok) {
        throw new Error("Failed to save career map.");
      }

      setSaveState("saved");
    } catch (error) {
      console.error("[CareerPlanning] save failed", error);
      setSaveState("error");
    }
  };

  const handleCommitRoute = async () => {
    if (!selectedRouteKey) {
      return;
    }

    setCommitState("saving");

    try {
      const response = await fetch("/api/career-planning/current-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPersistPayload("route_commit")),
      });

      if (!response.ok) {
        throw new Error("Failed to commit career route.");
      }

      setCommitState("saved");
      setSaveState("saved");
    } catch (error) {
      console.error("[CareerPlanning] route commit failed", error);
      setCommitState("error");
    }
  };

  const handleSelectRoute = (directionKey: string) => {
    setSelectedRouteKey(directionKey);
    setSaveState("idle");
    setCommitState("idle");
  };

  const saveMapButton = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleSaveCareerMap()}
        disabled={saveState === "saving" || data.snapshot.status !== "ready"}
        className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-1.5">
          {saveState === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveState === "saved" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saveState === "saved" ? "已保存" : saveState === "error" ? "重试" : "保存"}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void handleCommitRoute()}
        disabled={!selectedRouteKey || commitState === "saving" || data.snapshot.status !== "ready"}
        className="rounded-full bg-[var(--color-text)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="inline-flex items-center gap-1.5">
          {commitState === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : commitState === "saved" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : null}
          {commitState === "saved" ? "已确认" : commitState === "error" ? "重试确认" : "确认主线"}
        </span>
      </button>
    </div>
  );
  const mapHeaderAction = data.snapshot.status === "ready" ? saveMapButton : null;

  const handleSubmit = async () => {
    const nextInput = input;
    const trimmedText = nextInput.trim();
    if (!trimmedText || isLoading) {
      return;
    }

    setInput("");
    try {
      await sendCareerMessage(trimmedText);
    } catch (error) {
      setInput(nextInput);
      console.error("[CareerPlanning] send failed", error);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitOnEnter(event)) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const chatViewport = (
    <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[calc(100vw-32px)] space-y-4 md:max-w-[780px]">
        <AIDegradationBanner kind={chat.aiDegradedKind} />

        {messages.length === 0 && !isLoading ? (
          <WorkspaceEmptyState
            icon={Compass}
            eyebrow="职业访谈"
            title="先从你的课程开始"
            description={buildInitialDescription(data)}
            footer={
              <div className="flex flex-wrap justify-center gap-2">
                {data.starterPrompts.map((prompt) => (
                  <PromptChip
                    key={prompt}
                    label={prompt}
                    onClick={() => void sendCareerMessage(prompt)}
                  />
                ))}
              </div>
            }
            className="mx-auto max-w-2xl"
          />
        ) : null}

        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            onSendReply={sendCareerMessage}
            isStreaming={isLoading && index === messages.length - 1}
          />
        ))}

        {isAILoading ? <LoadingDots /> : null}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  const composer = (
    <div className="safe-bottom shrink-0 border-black/[0.04] border-t bg-white/84 px-4 pb-4 pt-3 backdrop-blur-xl md:px-6 md:pb-5 md:pt-4">
      <div className="mx-auto max-w-[calc(100vw-32px)] md:max-w-[780px]">
        <div className="ui-input-shell flex items-end gap-2 rounded-[20px] p-2 md:gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="回答这个问题，或说说你真实的犹豫..."
            rows={1}
            className="min-h-[24px] max-h-[120px] flex-1 resize-none border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              input.trim() && !isLoading
                ? "ui-primary-button"
                : "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]",
            )}
            aria-label="发送"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const mobileMapStatus =
    isMobile && mobileView === "chat" ? (
      <div className="shrink-0 border-black/[0.04] border-t bg-white/94 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMobileView("map")}
          className="ui-message-card flex w-full items-center gap-3 rounded-[22px] p-3 text-left transition-transform active:scale-[0.99]"
        >
          <div className="ui-primary-button flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">职业地图</span>
              <span className="rounded-full bg-[var(--color-active)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                实时校准
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
              {activeRouteTitle}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            查看
          </span>
        </button>
      </div>
    ) : null;

  return (
    <div className="ui-page-shell flex h-dvh min-h-0 overflow-hidden">
      {!isMobile ? (
        <div className="h-full w-[430px] shrink-0 overflow-hidden border-black/[0.04] border-r lg:w-[460px]">
          <CareerMapPanel
            data={data}
            activeRouteKey={selectedRouteKey}
            draft={careerMapDraft}
            headerAction={mapHeaderAction}
            onSelectRoute={handleSelectRoute}
          />
        </div>
      ) : null}

      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <header className="ui-page-frame safe-top flex shrink-0 items-center justify-between gap-4 pb-4 pt-5 md:pb-5 md:pt-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/profile"
              className="ui-control-surface rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
              aria-label="返回"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="ui-primary-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-semibold text-[var(--color-text)]">职业访谈</h1>
                <p className="truncate text-xs text-[var(--color-text-tertiary)]">课程证据驱动</p>
              </div>
            </div>
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileView((view) => (view === "chat" ? "map" : "chat"))}
              className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {mobileView === "chat" ? "看地图" : "回对话"}
            </button>
          ) : null}
        </header>

        {isMobile && mobileView === "map" ? (
          <CareerMapPanel
            data={data}
            activeRouteKey={selectedRouteKey}
            draft={careerMapDraft}
            onSelectRoute={handleSelectRoute}
            headerAction={mapHeaderAction}
          />
        ) : (
          chatViewport
        )}

        {mobileMapStatus}
        {mobileView === "chat" ? composer : null}
      </section>
    </div>
  );
}

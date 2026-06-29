"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatActivityIndicator } from "@/components/chat/ChatActivityIndicator";
import { ChatComposer, type ChatComposerSubmitPayload } from "@/components/chat/ChatComposer";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { useChatSession } from "@/components/chat/useChatSession";
import { useInputProtection } from "@/components/common/useInputProtection";
import { ResearchSourceStrip } from "@/components/research/ResearchSourceStrip";
import { type CareerGraphPatch, careerGraphPatchSchema } from "@/lib/ai/career-planning/schemas";
import { buildCareerMentorPresentation } from "@/lib/career-planning/mentor-presentation";
import type { CareerPlanningWorkspaceData } from "@/lib/career-planning/workspace-data";
import { cn } from "@/lib/utils";

interface CareerPlanningMentorPanelProps {
  data: CareerPlanningWorkspaceData;
  selectedDirectionKey: string | null;
  onPatchChange?: (patch: CareerGraphPatch | null) => void;
  variant?: "panel" | "workspace";
}

const AI_MENTOR_BOOTSTRAP_TEXT = "__career_planning_mentor_bootstrap__";

function getLatestCareerGraphPatch(messages: UIMessage[]): CareerGraphPatch | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const patch = getCareerGraphPatchFromMessage(messages[messageIndex]);
    if (patch) {
      return patch;
    }
  }

  return null;
}

function getCareerGraphPatchFromMessage(message: UIMessage): CareerGraphPatch | null {
  if (message.role !== "assistant") {
    return null;
  }

  for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex--) {
    const part = message.parts[partIndex];
    if (
      !isToolUIPart(part) ||
      getToolName(part) !== "presentCareerGraphPatch" ||
      (part.state !== "input-available" && part.state !== "output-available")
    ) {
      continue;
    }

    const parsed = careerGraphPatchSchema.safeParse(part.input);
    return parsed.success ? parsed.data : null;
  }

  return null;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function isInternalMentorBootstrap(message: UIMessage): boolean {
  return message.role === "user" && getMessageText(message) === AI_MENTOR_BOOTSTRAP_TEXT;
}

function getRestoredPatch(data: CareerPlanningWorkspaceData): CareerGraphPatch | null {
  const restoredPatch = data.planningState?.graphPatch ?? null;

  if (!restoredPatch) {
    return null;
  }

  if (restoredPatch.author !== "ai") {
    return null;
  }

  if (data.snapshot.status !== "ready") {
    return restoredPatch;
  }

  const routeKeys = new Set(data.routes.map((route) => route.directionKey));
  return restoredPatch.targetDirectionKey && routeKeys.has(restoredPatch.targetDirectionKey)
    ? restoredPatch
    : null;
}

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

function MentorThinkingState({ showSlowHint }: { showSlowHint: boolean }) {
  return (
    <div className="space-y-2">
      <ChatActivityIndicator label="正在分析职业路径..." />
      <p className="text-xs leading-5 text-[var(--color-text-tertiary)]">
        正在整理课程、能力和市场信号，完成后会直接给出导师判断。
      </p>
      {showSlowHint ? (
        <p className="text-xs leading-5 text-[var(--color-text-tertiary)]">
          涉及前沿岗位时会先做联网研究，可能多等几秒。
        </p>
      ) : null}
    </div>
  );
}

function MentorBriefCard({ patch }: { patch: CareerGraphPatch }) {
  const presentation = buildCareerMentorPresentation(patch);

  return (
    <div className="space-y-4">
      {presentation.observation ? (
        <p className="text-[0.9375rem] leading-7 tracking-[-0.01em] text-[var(--color-text)]">
          {presentation.observation}
        </p>
      ) : null}

      {presentation.directions.length > 0 ? (
        <div className="space-y-2">
          {presentation.directions.map((direction) => (
            <div
              key={`${direction.title}-${direction.counselorTake}`}
              className="rounded-[22px] border border-black/[0.055] bg-white/72 px-3.5 py-3"
            >
              <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                {direction.title}
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-secondary)]">
                {direction.counselorTake}
              </p>
              {direction.decisionPressure ? (
                <p className="mt-2 border-black/[0.05] border-t pt-2 text-[0.6875rem] leading-5 text-[var(--color-text-tertiary)]">
                  {direction.decisionPressure}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {presentation.skillPriorities.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {presentation.skillPriorities.map((skill) => (
            <span
              key={`${skill.title}-${skill.why}`}
              className="rounded-full border border-black/[0.06] bg-white/68 px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-secondary)]"
              title={skill.why}
            >
              {skill.title}
            </span>
          ))}
        </div>
      ) : null}

      {presentation.marketContext ? (
        <p className="text-xs leading-5 text-[var(--color-text-tertiary)]">
          {presentation.marketContext}
        </p>
      ) : null}

      {presentation.researchSources.length > 0 ? (
        <ResearchSourceStrip
          sources={presentation.researchSources.map((source, index) => ({
            id: source.sourceId ?? `S${index + 1}`,
            title: source.title,
            url: source.url,
            domain: source.domain ?? getDomainLabel(source.url),
            provider: source.provider,
            qualityTier: source.qualityTier,
          }))}
          label={`来源 ${presentation.researchSources.length}`}
          meta={presentation.researchSources
            .slice(0, 2)
            .map((source) => source.domain ?? getDomainLabel(source.url))}
          defaultOpen={false}
          variant="compact"
        />
      ) : null}

      <div className="rounded-[20px] bg-[var(--color-panel-soft)] px-3.5 py-3">
        <p className="text-sm leading-6 text-[var(--color-text)]">{presentation.question}</p>
      </div>
    </div>
  );
}

export function CareerPlanningMentorPanel({
  data,
  onPatchChange,
  selectedDirectionKey,
  variant = "panel",
}: CareerPlanningMentorPanelProps) {
  const [planningSessionId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [showSlowThinkingHint, setShowSlowThinkingHint] = useState(false);
  const bootstrapSentRef = useRef(false);
  const savedPatchSignatureRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { handlePaste } = useInputProtection();
  const chat = useChatSession({
    sessionId: null,
    localId: `career-planning:${planningSessionId}`,
    body: () => ({
      metadata: {
        context: "career" as const,
        entry: "planning" as const,
        selectedDirectionKey: selectedDirectionKey ?? undefined,
      },
    }),
  });
  const messages = useMemo(
    () => chat.messages.filter((message: UIMessage) => message.role !== "system"),
    [chat.messages],
  );
  const streamedPatch = useMemo(() => getLatestCareerGraphPatch(messages), [messages]);
  const restoredPatch = useMemo(() => getRestoredPatch(data), [data]);
  const patch = streamedPatch ?? restoredPatch;
  const status = chat.status;
  const hasError = status === "error" || Boolean(chat.error);
  const isLoading = status === "submitted" || status === "streaming";
  const renderedMessages = messages
    .map((message) => ({
      patch: getCareerGraphPatchFromMessage(message),
      message,
      text: getMessageText(message),
    }))
    .filter(
      ({ patch, message, text }) =>
        !isInternalMentorBootstrap(message) && (message.role === "user" || Boolean(patch) || text),
    );
  const isAILoading =
    isLoading &&
    (renderedMessages.length === 0 ||
      renderedMessages[renderedMessages.length - 1]?.message.role === "user");
  const showInitialAssistantShell = renderedMessages.length === 0;
  const showFollowupAssistantLoading = isAILoading && renderedMessages.length > 0;
  const showEmptyError = renderedMessages.length === 0 && !patch && hasError;

  const sendCareerMessage = async (text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText || isLoading) {
      return;
    }

    await chat.sendMessage({ text: trimmedText });
  };

  const handleComposerSubmit = async ({ text }: ChatComposerSubmitPayload) => {
    await sendCareerMessage(text);
  };

  const question = patch?.nextQuestion.question ?? null;

  useEffect(() => {
    if (patch || hasError || isLoading || messages.length > 0 || bootstrapSentRef.current) {
      return;
    }

    bootstrapSentRef.current = true;
    void chat.sendMessage({ text: AI_MENTOR_BOOTSTRAP_TEXT }).catch((error) => {
      console.error("[CareerPlanningMentorPanel] bootstrap failed", error);
      bootstrapSentRef.current = false;
    });
  }, [chat, hasError, isLoading, messages.length, patch]);

  useEffect(() => {
    if (hasError) {
      bootstrapSentRef.current = false;
    }
  }, [hasError]);

  useEffect(() => {
    if (!isAILoading || patch) {
      setShowSlowThinkingHint(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setShowSlowThinkingHint(true);
    }, 6000);

    return () => window.clearTimeout(timerId);
  }, [isAILoading, patch]);

  const retryBootstrap = async () => {
    if (isLoading) {
      return;
    }

    chat.clearError();
    bootstrapSentRef.current = true;

    try {
      await chat.sendMessage({ text: AI_MENTOR_BOOTSTRAP_TEXT });
    } catch (error) {
      console.error("[CareerPlanningMentorPanel] retry bootstrap failed", error);
      bootstrapSentRef.current = false;
    }
  };

  useEffect(() => {
    onPatchChange?.(patch ?? null);
  }, [onPatchChange, patch]);

  useEffect(() => {
    if (renderedMessages.length === 0 && !isAILoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [renderedMessages.length, isAILoading]);

  useEffect(() => {
    if (!streamedPatch || isLoading) {
      return;
    }

    const patchSignature = JSON.stringify(streamedPatch);
    if (savedPatchSignatureRef.current === patchSignature) {
      return;
    }

    savedPatchSignatureRef.current = patchSignature;

    void fetch("/api/career-planning/revisions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: planningSessionId,
        source: "manual_save",
        selectedRouteKey: streamedPatch.targetDirectionKey,
        graphPatch: streamedPatch,
      }),
    }).catch((error) => {
      console.error("[CareerPlanningMentorPanel] save graph patch failed", error);
      savedPatchSignatureRef.current = null;
    });
  }, [isLoading, planningSessionId, streamedPatch]);

  const isWorkspace = variant === "workspace";
  const assistantBubbleClassName = cn(
    "ui-message-card rounded-[26px] px-4 py-3.5 text-sm text-[var(--color-text)]",
    isWorkspace ? "max-w-[var(--message-max-width)]" : "w-full",
  );

  return (
    <aside className={cn("flex h-full min-h-0 flex-col bg-white", !isWorkspace && "safe-bottom")}>
      {!isWorkspace ? (
        <header className="shrink-0 border-b border-black/[0.04] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text)]">职业规划导师</h2>
        </header>
      ) : null}

      <div
        className={cn(
          "mobile-scroll min-h-0 flex-1 overflow-y-auto",
          isWorkspace ? "px-4 py-6 md:px-6 md:py-8" : "px-5 py-5",
        )}
      >
        <div
          className={cn(
            "space-y-4",
            isWorkspace && "mx-auto max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)]",
          )}
        >
          {showInitialAssistantShell ? (
            <div className="flex justify-start">
              <div className={assistantBubbleClassName}>
                {question ? (
                  <MentorBriefCard patch={patch as CareerGraphPatch} />
                ) : showEmptyError ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-7">刚才没有连上模型服务。</p>
                    <button
                      type="button"
                      onClick={() => void retryBootstrap()}
                      className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-black/20 hover:text-[var(--color-text)]"
                    >
                      重试
                    </button>
                  </div>
                ) : (
                  <MentorThinkingState showSlowHint={showSlowThinkingHint} />
                )}
              </div>
            </div>
          ) : null}

          {renderedMessages.map(({ patch: messagePatch, message, text }, messageIndex) => {
            const isUser = message.role === "user";

            return (
              <div
                key={`${message.id}:${messageIndex}`}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "min-w-0 break-words text-sm [overflow-wrap:anywhere]",
                    isUser
                      ? cn(
                          "ui-primary-button rounded-3xl rounded-br-md px-4 py-3",
                          isWorkspace ? "max-w-[min(78%,var(--message-max-width))]" : "max-w-[78%]",
                        )
                      : assistantBubbleClassName,
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {text}
                    </p>
                  ) : messagePatch ? (
                    <MentorBriefCard patch={messagePatch} />
                  ) : (
                    <StreamdownMessage content={text} />
                  )}
                </div>
              </div>
            );
          })}

          {showFollowupAssistantLoading ? (
            <div className="flex justify-start">
              <div className={assistantBubbleClassName}>
                <MentorThinkingState showSlowHint={showSlowThinkingHint} />
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer
        className={cn(
          "safe-bottom shrink-0 border-black/[0.04] border-t bg-white/86 pb-5 pt-4 backdrop-blur-xl",
          isWorkspace ? "px-4 md:px-6" : "px-5",
        )}
      >
        <div
          className={cn(
            isWorkspace && "mx-auto max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)]",
          )}
        >
          <ChatComposer
            value={input}
            onValueChange={setInput}
            onSubmit={handleComposerSubmit}
            onSubmitError={(error) => {
              console.error("[CareerPlanningMentorPanel] send failed", error);
            }}
            onPaste={handlePaste}
            placeholder="直接回复导师..."
            isLoading={isLoading}
            className={cn(isWorkspace && "rounded-2xl md:p-3")}
            inputRowClassName={cn(isWorkspace && "md:gap-3")}
            textareaClassName="max-h-[120px]"
            submitButtonClassName="rounded-full"
          />
        </div>
      </footer>
    </aside>
  );
}

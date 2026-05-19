import type { Agent, ToolSet, UIMessage } from "ai";
import type { after as afterFn } from "next/server";
import { getChatResumableStreamContext } from "@/lib/ai/core/resumable-streams";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { buildPersonalization } from "@/lib/ai/personalization";
import { notFound } from "@/lib/api";
import { syncConversationKnowledge } from "@/lib/chat/conversation-knowledge";
import { buildConversationMemoryContext } from "@/lib/chat/conversation-memory";
import {
  getConversationActiveStreamId,
  persistConversationMessages,
  setConversationActiveStreamId,
} from "@/lib/chat/conversation-persistence";
import {
  ConversationUnavailableError,
  getOwnedConversationSummary,
  mergeOwnedConversationMetadata,
  touchOwnedConversation,
} from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";
import type { RequestMetadata } from "@/types/request-metadata";

type ScheduleAfter = typeof afterFn;

function appendContextBlock(base: string, block: string | null | undefined): string {
  return [base, block].filter(Boolean).join("\n\n");
}

function getFirstUserMessageTitle(messages: UIMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const textPart = firstUserMessage?.parts.find((part) => part.type === "text");
  return textPart && "text" in textPart ? textPart.text.slice(0, 100) : "新对话";
}

export function isPersistentChatSession(sessionId: string | null | undefined): sessionId is string {
  return Boolean(sessionId && isUuidString(sessionId));
}

export function getPersistableConversationMetadata(
  metadata: RequestMetadata | undefined,
): Record<string, unknown> | undefined {
  if (!metadata?.context || metadata.context === "default") {
    return undefined;
  }

  return metadata;
}

export async function buildChatPersonalizationContext(params: {
  userId: string;
  sessionId?: string | null;
  skinSlug?: string | null;
  assistantInstruction?: string | null;
}): Promise<{
  behaviorPrompt: string;
  skinPrompt: string;
  userContext: string;
}> {
  const { behaviorPrompt, skinPrompt, userContext } = await buildPersonalization(params.userId, {
    skinSlug: params.skinSlug ?? undefined,
  });

  let resolvedUserContext = userContext;
  if (isPersistentChatSession(params.sessionId)) {
    const summary = await getOwnedConversationSummary(params.sessionId, params.userId);
    const memoryContext = buildConversationMemoryContext(summary);
    if (memoryContext) {
      resolvedUserContext = [resolvedUserContext, memoryContext].filter(Boolean).join("\n\n");
    }
  }

  return {
    behaviorPrompt,
    skinPrompt,
    userContext: appendContextBlock(
      resolvedUserContext,
      params.assistantInstruction ? `## 本轮路由约束\n${params.assistantInstruction}` : null,
    ),
  };
}

export async function touchChatConversation(params: {
  userId: string;
  sessionId?: string | null;
  messages: UIMessage[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!params.sessionId) {
    return;
  }

  if (!isUuidString(params.sessionId)) {
    console.warn("[ChatSession] Skip upsert for non-UUID sessionId:", params.sessionId);
    return;
  }

  try {
    await touchOwnedConversation({
      conversationId: params.sessionId,
      userId: params.userId,
      title: getFirstUserMessageTitle(params.messages),
      messageCount: params.messages.length,
      intent: "CHAT",
    });

    if (params.metadata) {
      await mergeOwnedConversationMetadata({
        conversationId: params.sessionId,
        userId: params.userId,
        metadataPatch: params.metadata,
      });
    }
  } catch (error) {
    if (error instanceof ConversationUnavailableError) {
      throw notFound("会话不存在或无权访问", "CONVERSATION_NOT_FOUND");
    }

    console.warn("[ChatSession] Failed to upsert session:", error);
  }
}

export async function clearActiveChatStream(params: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  if (await getConversationActiveStreamId(params.sessionId, params.userId)) {
    await setConversationActiveStreamId(params.sessionId, params.userId, null);
  }
}

export async function createChatStreamResponse<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = ToolSet,
>(params: {
  agent: Agent<CALL_OPTIONS, TOOLS, never>;
  messages: UIMessage[];
  userId: string;
  sessionId?: string | null;
  scheduleAfter: ScheduleAfter;
}): Promise<Response> {
  if (isPersistentChatSession(params.sessionId)) {
    await persistConversationMessages(params.sessionId, params.userId, params.messages);
    await clearActiveChatStream({
      sessionId: params.sessionId,
      userId: params.userId,
    });
  }

  const resumableStreamContext = getChatResumableStreamContext(params.scheduleAfter);

  return createNexusNoteStreamResponse(params.agent, params.messages, {
    sessionId: params.sessionId ?? undefined,
    presentation: "chat",
    onFinish: async ({ messages }) => {
      const persistentSessionId = isPersistentChatSession(params.sessionId)
        ? params.sessionId
        : null;
      if (!persistentSessionId) {
        return;
      }

      await persistConversationMessages(persistentSessionId, params.userId, messages);
      await setConversationActiveStreamId(persistentSessionId, params.userId, null);
      params.scheduleAfter(async () => {
        await syncConversationKnowledge({
          conversationId: persistentSessionId,
          userId: params.userId,
          messages,
        });
      });
    },
    consumeSseStream: async ({ stream }) => {
      if (!isPersistentChatSession(params.sessionId)) {
        return;
      }

      const streamId = crypto.randomUUID();
      await resumableStreamContext.createNewResumableStream(streamId, () => stream);
      await setConversationActiveStreamId(params.sessionId, params.userId, streamId);
    },
  });
}

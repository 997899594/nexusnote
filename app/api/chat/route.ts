/**
 * AI Chat API - 2026 Modern Architecture
 *
 * 2026 架构：
 * - Chat 专注通用对话
 * - INTERVIEW 意图由客户端跳转到 /interview 页面
 * - 无人设式混杂语义
 */

import type { UIMessage } from "ai";
import { after, type NextRequest, NextResponse } from "next/server";
import {
  aiProvider,
  ChatApiRequestSchema,
  classifyAIDegradation,
  createTelemetryContext,
  getAgent,
  getCapabilityProfile,
  getChatResumableStreamContext,
  getErrorMessage,
  recordAIUsage,
} from "@/lib/ai";
import { resolveChatContext } from "@/lib/ai/context/resolve-chat-context";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { buildPersonalization } from "@/lib/ai/personalization";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { buildConversationMemoryContext } from "@/lib/chat/conversation-memory";
import {
  getConversationActiveStreamId,
  persistConversationMessages,
  setConversationActiveStreamId,
} from "@/lib/chat/conversation-persistence";
import {
  ConversationUnavailableError,
  getOwnedConversationSummary,
  touchOwnedConversation,
} from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  let telemetry = createTelemetryContext({
    requestId,
    endpoint: "/api/chat",
  });

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    // Rate Limiting
    await checkRateLimitOrThrow(userId, 100, 60 * 1000, "请求过于频繁，请稍后再试");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new APIError("无效的 JSON", 400, "INVALID_JSON");
    }

    const validation = ChatApiRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: validation.error.issues } },
        { status: 400 },
      );
    }

    const { messages, sessionId, skinSlug, courseId, metadata } = validation.data;

    const uiMessages = messages as UIMessage[];
    const resolvedContext = await resolveChatContext({
      userId,
      courseId,
      metadata,
    });
    const { profileId, courseId: resolvedCourseId, metadata: resolvedMetadata } = resolvedContext;
    const profile = getCapabilityProfile(profileId);
    telemetry = createTelemetryContext({
      requestId,
      endpoint: "/api/chat",
      userId,
      profile: profileId,
      promptVersion: profile.promptKey,
      modelPolicy: profile.modelPolicy,
      metadata: {
        sessionId: sessionId ?? null,
        courseId: resolvedCourseId ?? null,
        context: resolvedMetadata?.context ?? null,
      },
    });

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // Personalization: Load behavior policy, skin, context
    // ============================================

    let behaviorPrompt = "";
    let skinPrompt = "";
    let userContext = "";

    if (userId) {
      const {
        behaviorPrompt: personalizationBehaviorPrompt,
        skinPrompt: personalizationSkinPrompt,
        userContext: context,
      } = await buildPersonalization(userId, { skinSlug });
      behaviorPrompt = personalizationBehaviorPrompt;
      skinPrompt = personalizationSkinPrompt;
      userContext = context;
    }

    const hasPersistentSession = Boolean(sessionId && userId && isUuidString(sessionId));
    let ownedConversationSummary: string | null = null;

    if (hasPersistentSession && sessionId) {
      ownedConversationSummary = await getOwnedConversationSummary(sessionId, userId);

      const memoryContext = buildConversationMemoryContext(ownedConversationSummary);
      if (memoryContext) {
        userContext = [userContext, memoryContext].filter(Boolean).join("\n\n");
      }
    }

    // upsert conversation
    if (sessionId && userId && isUuidString(sessionId)) {
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let title = "新对话";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          title = textPart.text.slice(0, 100);
        }
      }

      try {
        await touchOwnedConversation({
          conversationId: sessionId,
          userId,
          title,
          messageCount: uiMessages.length,
          intent: "CHAT",
        });
      } catch (error) {
        if (error instanceof ConversationUnavailableError) {
          throw new APIError("会话不存在或无权访问", 404, "NOT_FOUND");
        }

        console.warn("[ChatSession] Failed to upsert session:", error);
      }
    } else if (sessionId && !isUuidString(sessionId)) {
      console.warn("[ChatSession] Skip upsert for non-UUID sessionId:", sessionId);
    }

    // Get agent with personalization
    const agent = await getAgent(profileId, {
      userId,
      behaviorPrompt,
      skinPrompt,
      userContext,
      courseId: resolvedCourseId,
      metadata: resolvedMetadata,
      telemetry,
    });

    if (hasPersistentSession && sessionId) {
      await persistConversationMessages(sessionId, userId, uiMessages);
      if (await getConversationActiveStreamId(sessionId, userId)) {
        await setConversationActiveStreamId(sessionId, userId, null);
      }
    }

    const resumableStreamContext = getChatResumableStreamContext(after);

    const response = await createNexusNoteStreamResponse(agent, uiMessages, {
      sessionId,
      presentation: "chat",
      onFinish: async ({ messages }) => {
        if (!hasPersistentSession || !sessionId) {
          return;
        }

        await persistConversationMessages(sessionId, userId, messages);
        await setConversationActiveStreamId(sessionId, userId, null);
      },
      consumeSseStream: async ({ stream }) => {
        if (!hasPersistentSession || !sessionId) {
          return;
        }

        const streamId = crypto.randomUUID();
        await resumableStreamContext.createNewResumableStream(streamId, () => stream);
        await setConversationActiveStreamId(sessionId, userId, streamId);
      },
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    const degradation = classifyAIDegradation(error);
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startTime,
      success: false,
      errorMessage: getErrorMessage(error),
    });

    const response = handleError(error);
    response.headers.set("X-Request-Id", requestId);
    if (degradation) {
      response.headers.set("X-AI-Degraded", degradation.kind);
    }
    return response;
  }
}

export async function GET() {
  const providerStatus = aiProvider.getStatus();
  return NextResponse.json({
    status: "ok",
    ai: {
      configured: aiProvider.isConfigured(),
      primaryProvider: providerStatus.primaryProvider,
      providers: providerStatus.providers,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * AI Chat API - 2026 Modern Architecture
 *
 * 2026 架构：
 * - Chat 专注通用对话
 * - INTERVIEW 意图由客户端跳转到 /interview 页面
 * - 无 Persona 冲突
 */

import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { conversations, db } from "@/db";
import {
  aiProvider,
  ChatApiRequestSchema,
  createTelemetryContext,
  getAgent,
  getCapabilityProfile,
  getErrorMessage,
  recordAIUsage,
} from "@/lib/ai";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { buildPersonalization } from "@/lib/ai/personalization";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const runtime = "nodejs";
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

    const { messages, sessionId, personaSlug, courseId, metadata } = validation.data;

    const uiMessages = messages as UIMessage[];

    const profileId = metadata?.context === "learn" || courseId ? "LEARN_ASSIST" : "CHAT_BASIC";
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
        courseId:
          courseId ?? (metadata?.context === "learn" ? metadata.courseId : undefined) ?? null,
        context: metadata?.context ?? null,
      },
    });

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // Personalization: Load persona, context
    // ============================================

    let personaSystemPrompt = "";
    let userContext = "";

    if (userId) {
      const { systemPrompt, userContext: context } = await buildPersonalization(userId, {
        personaSlug,
      });
      personaSystemPrompt = systemPrompt;
      userContext = context;
    }

    // upsert conversation
    if (sessionId && userId) {
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let title = "新对话";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          title = textPart.text.slice(0, 100);
        }
      }

      try {
        await db
          .insert(conversations)
          .values({
            id: sessionId,
            userId,
            title,
            intent: "CHAT",
            messageCount: uiMessages.length,
          })
          .onConflictDoUpdate({
            target: conversations.id,
            set: {
              messageCount: uiMessages.length,
              lastMessageAt: new Date(),
            },
          });
      } catch (insertError) {
        console.warn("[ChatSession] Failed to upsert session:", insertError);
      }
    }

    // Get agent with personalization
    const agent = await getAgent(profileId, {
      userId,
      personaPrompt: personaSystemPrompt,
      userContext,
      courseId: courseId ?? (metadata?.context === "learn" ? metadata.courseId : undefined),
      metadata,
      telemetry,
    });

    const response = await createNexusNoteStreamResponse(agent, uiMessages, {
      sessionId,
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startTime,
      success: false,
      errorMessage: getErrorMessage(error),
    });

    const response = handleError(error);
    response.headers.set("X-Request-Id", requestId);
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
      fallbackEnabled: providerStatus.fallbackEnabled,
    },
    timestamp: new Date().toISOString(),
  });
}

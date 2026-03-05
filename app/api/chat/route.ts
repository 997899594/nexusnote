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
import { aiUsage, conversations, db } from "@/db";
import { aiProvider, getAgent, validateRequest } from "@/lib/ai";
import { buildPersonalization } from "@/lib/ai/personalization";
import { createNexusNoteStreamResponse } from "@/lib/ai/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================
// Helper Functions
// ============================================

async function trackUsage(
  userId: string,
  intent: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
) {
  try {
    await db.insert(aiUsage).values({
      userId,
      endpoint: "/api/chat",
      intent,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costCents: Math.round((inputTokens * 0.00015 + outputTokens * 0.0006) * 100),
      durationMs,
      success: true,
    });
  } catch (error) {
    console.error("[Usage] Failed to track:", error);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id || "anonymous";

    // Rate Limiting
    if (userId) {
      checkRateLimitOrThrow(userId, 100, 60 * 1000, "请求过于频繁，请稍后再试");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new APIError("无效的 JSON", 400, "INVALID_JSON");
    }

    const validation = validateRequest(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: validation.error.issues } },
        { status: 400 },
      );
    }

    const { messages, intent: clientIntent, sessionId, personaSlug } = validation.data;

    // 客户端显式指定的 intent（如 /interview 命令）
    // 如果是 INTERVIEW，说明客户端没有正确跳转
    if (clientIntent === "INTERVIEW") {
      throw new APIError("INTERVIEW 意图应跳转到 /interview 页面", 400, "INVALID_INTENT");
    }

    // Chat 只处理 CHAT/COURSE/SKILLS，旧 intent 映射到 CHAT
    const intent = clientIntent === "EDITOR" || clientIntent === "SEARCH" ? "CHAT" : (clientIntent || "CHAT");
    const uiMessages = messages as UIMessage[];

    console.log("[Chat] Request received, personaSlug:", personaSlug, "intent:", intent);

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // Personalization: Load persona, context
    // ============================================

    let personaSystemPrompt = "";
    let userContext = "";

    if (userId && userId !== "anonymous") {
      const { systemPrompt, userContext: context } = await buildPersonalization(userId, {
        personaSlug,
      });
      personaSystemPrompt = systemPrompt;
      userContext = context;
    }

    // upsert conversation
    if (sessionId && userId && userId !== "anonymous") {
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
    const agent = getAgent(intent, {
      personaPrompt: personaSystemPrompt,
      userContext,
    });

    const response = await createNexusNoteStreamResponse(agent, uiMessages);

    const durationMs = Date.now() - startTime;

    if (userId && userId !== "anonymous") {
      trackUsage(userId, intent, "gemini-3-flash-preview", 0, 0, durationMs).catch(console.error);
    }

    if (sessionId) {
      response.headers.set("X-Session-Id", sessionId);
    }
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return response;
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured(), provider: "302.ai" },
    timestamp: new Date().toISOString(),
  });
}

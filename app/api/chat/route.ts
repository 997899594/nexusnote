/**
 * AI Chat API - 2026 Modern Architecture
 * Enhanced with Personalization: Personas, Long-term Memory, Emotion Detection
 */

import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { aiUsage, conversations, db } from "@/db";
import { aiProvider, getAgent, validateRequest } from "@/lib/ai";
import { getPersona, getUserPersonaPreference } from "@/lib/ai/personas";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { buildEmotionAdaptationPrompt, detectEmotion } from "@/lib/emotion";
import { buildChatContext } from "@/lib/memory/chat-context-builder";

export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================
// Helper Functions
// ============================================

/**
 * Extract text content from a UIMessage
 */
function extractTextFromMessage(message: UIMessage | undefined): string {
  if (!message?.parts) return "";
  return (
    message.parts
      .filter((p) => p.type === "text" && "text" in p)
      .map((p) => (p as { text: string }).text)
      .join(" ") || ""
  );
}

/**
 * Get explicitly requested persona or user's default
 */
async function getExplicitOrDefaultPersona(
  userId: string,
  explicitPersonaSlug: string | undefined,
) {
  if (explicitPersonaSlug) {
    return getPersona(explicitPersonaSlug);
  }
  // Get user's default persona preference
  const pref = await getUserPersonaPreference(userId);
  return getPersona(pref.defaultPersonaSlug);
}

// Rate Limiting - 简单内存实现
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const key = userId;
  const record = rateLimits.get(key);

  if (!record || record.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (record.count >= limit) {
    throw new APIError("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }

  record.count++;
}

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
      const limit = 100; // 每分钟 100 次
      checkRateLimit(userId, limit, 60 * 1000);
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

    const { messages, intent, sessionId, personaSlug } = validation.data;

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // Personalization: Load persona, context, emotion
    // ============================================

    // Get last user message for emotion detection
    const uiMessages = messages as UIMessage[];
    const lastUserMessage = uiMessages.filter((m) => m.role === "user").pop();
    const lastMessageText = extractTextFromMessage(lastUserMessage);

    // Parallel fetch personalization data for logged-in users
    let personaSystemPrompt = "";
    let userContext = "";
    let emotionAdaptation = "";

    if (userId && userId !== "anonymous") {
      const [persona, context, emotion] = await Promise.all([
        // Get persona (explicit or user's default)
        getExplicitOrDefaultPersona(userId, personaSlug),
        // Build user context from style analysis
        buildChatContext(userId),
        // Detect emotion from last message
        Promise.resolve(detectEmotion(lastMessageText)),
      ]);

      if (persona) {
        personaSystemPrompt = `\n=== AI Persona ===\n${persona.name}\n${persona.systemPrompt}\n`;
      }

      if (context) {
        userContext = `\n${context}\n`;
      }

      if (emotion) {
        emotionAdaptation = buildEmotionAdaptationPrompt(emotion);
      }
    }

    // 2026 架构：首条消息时 upsert 会话（幂等，支持客户端生成的 nanoid）
    if (sessionId && userId && userId !== "anonymous") {
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let title = "新对话";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          title = textPart.text.slice(0, 100);
        }
      }

      await db
        .insert(conversations)
        .values({
          id: sessionId,
          userId,
          title,
          intent,
          messageCount: uiMessages.length,
        })
        .onConflictDoNothing();
    }

    // Get agent with personalized instructions
    const agent = getAgent(intent, sessionId, {
      personaPrompt: personaSystemPrompt,
      userContext,
      emotionAdaptation,
    });

    const response = await createAgentUIStreamResponse({
      agent,
      uiMessages: messages as never,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
    });

    const durationMs = Date.now() - startTime;
    const model = intent === "COURSE" ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

    // 只有登录用户才记录用量 (userId 是有效 UUID)
    if (userId && userId !== "anonymous") {
      trackUsage(userId, intent, model, 0, 0, durationMs).catch(console.error);
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

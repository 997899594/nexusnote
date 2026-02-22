/**
 * AI Chat API - 2026 Modern Architecture
 */

import { aiUsage, conversations, db } from "@/db";
import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAgent } from "@/ui/ai/agents";
import { aiProvider } from "@/infrastructure/ai/provider";
import { validateRequest } from "@/ui/ai/validation";
import { authOptions } from "../auth/[...nextauth]/route";

export const runtime = "nodejs";
export const maxDuration = 300;

class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

function errorResponse(message: string, statusCode: number, code: string) {
  return NextResponse.json({ error: { message, code } }, { status: statusCode });
}

function handleError(error: unknown) {
  console.error("[API Error]", error);
  if (error instanceof APIError) {
    return errorResponse(error.message, error.statusCode, error.code);
  }
  if (error instanceof Error) {
    if (error.name === "ZodError") {
      return errorResponse("请求参数错误", 400, "VALIDATION_ERROR");
    }
    return errorResponse(error.message, 500, "INTERNAL_ERROR");
  }
  return errorResponse("未知错误", 500, "UNKNOWN_ERROR");
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
    const session = await getServerSession(authOptions);
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

    const { messages, intent, sessionId } = validation.data;

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // 2026 架构：首条消息时 upsert 会话（幂等，支持客户端生成的 nanoid）
    if (sessionId && userId && userId !== "anonymous") {
      const uiMessages = messages as UIMessage[];
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

    const agent = getAgent(intent, sessionId);

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

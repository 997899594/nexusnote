/**
 * AI Chat API - 2026 Modern Architecture
 *
 * 现代化实现：
 * - 统一入口 (/api/ai/chat)
 * - Zod 验证
 * - 懒加载 Provider
 * - Agent 路由
 */

import { env } from "@nexusnote/config";
import { createAgentUIStreamResponse, smoothStream } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { isAIConfigured, registry } from "@/features/shared/ai/registry";

// ============================================
// Schema - Zod 验证
// ============================================

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.union([z.string(), z.array(z.unknown())]),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1),
  intent: z.enum(["CHAT", "INTERVIEW", "COURSE_GENERATION", "EDITOR", "SEARCH"]).default("CHAT"),
  sessionId: z.string().uuid().optional(),
  initialGoal: z.string().max(500).optional(),
  courseGenerationContext: z.record(z.unknown()).optional(),
});

// ============================================
// Helpers
// ============================================

function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, 50000)
    .trim();
}

// ============================================
// API Route
// ============================================

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  // 1. 认证
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. 确保 Provider 已初始化 (懒加载)
  if (!isAIConfigured()) {
    const apiKey = env.AI_302_API_KEY;
    if (!apiKey) {
      return new Response("AI not configured", { status: 503 });
    }
    // Provider 会在首次使用时自动初始化
  }

  // 3. 解析和验证请求
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const result = ChatRequestSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error.issues }), { status: 400 });
  }

  const { messages, intent, sessionId, initialGoal, courseGenerationContext } = result.data;
  const userId = session.user.id;

  // 4. 净化输入
  const sanitized = messages.map((msg) => ({
    ...msg,
    content: typeof msg.content === "string" ? sanitizeInput(msg.content) : msg.content,
  }));

  // 5. 路由到对应的 Agent
  const response = await routeToAgent({
    intent,
    messages: sanitized,
    userId,
    sessionId,
    initialGoal,
    courseGenerationContext,
  });

  // 6. 设置响应头
  if (sessionId) {
    response.headers.set("X-Session-Id", sessionId);
  }
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

// ============================================
// Agent Router
// ============================================

async function routeToAgent(params: {
  intent: string;
  messages: any[];
  userId: string;
  sessionId?: string;
  initialGoal?: string;
  courseGenerationContext?: Record<string, unknown>;
}) {
  const { intent, messages, userId, sessionId, initialGoal, courseGenerationContext } = params;

  switch (intent) {
    case "INTERVIEW": {
      const { createInterviewAgent } = await import("@/features/learning/agent/interview-agent");
      const { createInterviewSession, getInterviewSession } = await import(
        "@/features/learning/services/interview-session"
      );

      let sid = sessionId;
      if (!sid && initialGoal) {
        sid = await createInterviewSession(userId, initialGoal);
      } else if (sid) {
        await getInterviewSession(sid, userId);
      }

      const agent = createInterviewAgent(sid!);

      return createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
        options: { userId, sessionId: sid },
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }

    case "COURSE_GENERATION": {
      const { courseGenerationAgent } = await import(
        "@/features/learning/agents/course-generation/agent"
      );

      const options = {
        id: (courseGenerationContext?.id as string) ?? crypto.randomUUID(),
        userId,
        interviewProfile: courseGenerationContext?.interviewProfile as Record<string, unknown>,
        outlineTitle: (courseGenerationContext?.outlineTitle as string) ?? "",
        outlineData: courseGenerationContext?.outlineData as any,
        moduleCount: (courseGenerationContext?.moduleCount as number) ?? 0,
        totalChapters: (courseGenerationContext?.totalChapters as number) ?? 0,
        currentModuleIndex: (courseGenerationContext?.currentModuleIndex as number) ?? 0,
        currentChapterIndex: (courseGenerationContext?.currentChapterIndex as number) ?? 0,
        chaptersGenerated: (courseGenerationContext?.chaptersGenerated as number) ?? 0,
      };

      return createAgentUIStreamResponse({
        agent: courseGenerationAgent,
        uiMessages: messages,
        options,
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }

    default: {
      const { chatAgent } = await import("@/features/chat/agents/chat-agent");
      return createAgentUIStreamResponse({
        agent: chatAgent,
        uiMessages: messages,
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }
  }
}

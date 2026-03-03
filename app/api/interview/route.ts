/**
 * Interview API - 独立的访谈接口
 *
 * 2026 架构：
 * - 专注于 INTERVIEW intent
 * - 无 Persona 干扰
 * - 服务端管理课程状态
 */

import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { conversations, courseSessions, db } from "@/db";
import type { InterviewProfile } from "@/db/schema";
import { aiProvider, getAgent, validateRequest } from "@/lib/ai";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
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

    const { messages, sessionId, courseId: inputCourseId } = validation.data;

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // 获取或创建课程
    // ============================================
    let activeCourseId = inputCourseId;
    const uiMessages = messages as UIMessage[];

    if (activeCourseId) {
      // 验证课程存在且属于当前用户
      const existingCourse = await db.query.courseSessions.findFirst({
        where: (c, { eq, and }) => and(eq(c.id, activeCourseId!), eq(c.userId, userId)),
      });

      if (!existingCourse) {
        activeCourseId = undefined;
      }
    }

    if (!activeCourseId) {
      // 创建新的课程
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let goal = "学习新知识";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          goal = textPart.text.slice(0, 200);
        }
      }

      const [newCourse] = await db
        .insert(courseSessions)
        .values({
          userId,
          title: goal,
          interviewProfile: {
            goal,
            domain: null,
            complexity: "moderate",
            background: null,
            currentLevel: "none",
            targetOutcome: null,
            timeConstraints: null,
            insights: [],
            readiness: 0,
            estimatedTurns: 3,
            currentTurn: 0,
          } satisfies InterviewProfile,
          interviewStatus: "interviewing",
          status: "idle",
        })
        .returning();

      activeCourseId = newCourse.id;
      console.log("[Interview] Created course:", activeCourseId);
    }

    // ============================================
    // 创建/更新 conversation 记录
    // ============================================
    if (sessionId) {
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let title = "课程访谈";

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
            intent: "INTERVIEW",
            messageCount: uiMessages.length,
            metadata: { courseId: activeCourseId },
          })
          .onConflictDoUpdate({
            target: conversations.id,
            set: {
              messageCount: uiMessages.length,
              lastMessageAt: new Date(),
              metadata: { courseId: activeCourseId },
            },
          });
      } catch (insertError) {
        console.warn("[Interview] Failed to upsert session:", insertError);
      }
    }

    // ============================================
    // 获取 Interview Agent
    // ============================================
    const agent = getAgent("INTERVIEW", {
      courseProfileId: activeCourseId,
    });

    const response = await createAgentUIStreamResponse({
      agent: agent as never,
      uiMessages: messages as never,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
      }),
    });

    const durationMs = Date.now() - startTime;
    console.log("[Interview] Request completed in", durationMs, "ms");

    if (sessionId) {
      response.headers.set("X-Session-Id", sessionId);
    }
    if (activeCourseId) {
      response.headers.set("X-Course-Id", activeCourseId);
    }

    return response;
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}

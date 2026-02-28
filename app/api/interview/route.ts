/**
 * Interview API - 独立的访谈接口
 *
 * 2026 架构：
 * - 专注于 INTERVIEW intent
 * - 无 Persona 干扰
 * - 服务端管理 courseProfile 状态
 */

import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { conversations, courseProfiles, db } from "@/db";
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

    const { messages, sessionId, courseProfileId } = validation.data;

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // 获取或创建 courseProfile
    // ============================================
    let activeCourseProfileId = courseProfileId;
    const uiMessages = messages as UIMessage[];

    if (activeCourseProfileId) {
      // 验证 courseProfile 存在且属于当前用户
      const existingProfile = await db.query.courseProfiles.findFirst({
        where: (profiles, { eq, and }) =>
          and(eq(profiles.id, activeCourseProfileId!), eq(profiles.userId, userId)),
      });

      if (!existingProfile) {
        activeCourseProfileId = undefined;
      }
    }

    if (!activeCourseProfileId) {
      // 创建新的课程画像
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let goal = "学习新知识";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          goal = textPart.text.slice(0, 200);
        }
      }

      const [newProfile] = await db
        .insert(courseProfiles)
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

      activeCourseProfileId = newProfile.id;
      console.log("[Interview] Created course profile:", activeCourseProfileId);
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
            metadata: { courseProfileId: activeCourseProfileId },
          })
          .onConflictDoUpdate({
            target: conversations.id,
            set: {
              messageCount: uiMessages.length,
              lastMessageAt: new Date(),
              metadata: { courseProfileId: activeCourseProfileId },
            },
          });
      } catch (insertError) {
        console.warn("[Interview] Failed to upsert session:", insertError);
      }
    }

    // ============================================
    // 获取 Interview Agent（无 Persona）
    // ============================================
    const interviewContext = `
=== Interview Context ===
User ID: ${userId}
Course Profile ID: ${activeCourseProfileId}

Use the User ID when calling createCourseProfile.
If a Course Profile ID is provided, use it for updateProfile and other tools.
`;

    const agent = getAgent("INTERVIEW", sessionId, {
      interviewContext,
    });

    const response = await createAgentUIStreamResponse({
      agent,
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
    if (activeCourseProfileId) {
      response.headers.set("X-Course-Profile-Id", activeCourseProfileId);
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

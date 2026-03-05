/**
 * Interview API - 独立的访谈接口
 *
 * 2026 架构：
 * 1. 单阶段 Agent - 无 phase 逻辑
 * 2. 简化状态机 - 仅管理 courseId
 * 3. 隐式上下文 - ID 通过闭包绑定
 */

import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { courseSessions, db } from "@/db";
import type { InterviewProfile } from "@/db/schema";
import { aiProvider, validateRequest } from "@/lib/ai";
import { createInterviewAgent } from "@/lib/ai/agents/interview";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================
// Types
// ============================================

// Phase types removed - interview is now single-phase

// ============================================
// Main Handler
// ============================================

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
    // 状态机：获取或创建课程
    // ============================================
    const state = await resolveInterviewState(userId, inputCourseId, messages as UIMessage[]);

    // ============================================
    // 创建 Agent
    // ============================================
    const agent = createInterviewAgent({
      userId,
      courseId: state.courseId,
      messages: messages as UIMessage[],
    });

    const response = await createNexusNoteStreamResponse(agent, messages as UIMessage[], {
      sessionId,
      resourceId: state.courseId,
    });

    const durationMs = Date.now() - startTime;
    console.log("[Interview]", { durationMs, courseId: state.courseId });

    return response;
  } catch (error) {
    return handleError(error);
  }
}

// ============================================
// State Machine Logic
// ============================================

async function resolveInterviewState(
  userId: string,
  inputCourseId: string | undefined,
  messages: UIMessage[],
): Promise<{ courseId: string }> {
  // 1. 尝试获取现有课程
  if (inputCourseId) {
    const existing = await db.query.courseSessions.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, inputCourseId!), eq(c.userId, userId)),
    });

    if (existing) {
      return { courseId: existing.id };
    }
  }

  // 2. 创建新课程
  const firstUserMessage = messages.find((m) => m.role === "user");
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

  console.log("[Interview] Created course:", newCourse.id);

  return { courseId: newCourse.id };
}

// ============================================
// Session Tracking
// ============================================

// 注意：session upsert 移到 streamResponse 内部处理
// 这里只负责核心的状态机逻辑

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}

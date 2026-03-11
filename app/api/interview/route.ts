/**
 * Interview API - 简化版访谈接口
 *
 * 2026 架构：
 * 1. 从数据库读取 interviewProfile 判断阶段
 * 2. 2 个工具：updateProfile + confirmOutline
 * 3. 工具返回数据，前端直接使用
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

export const runtime = "nodejs";
export const maxDuration = 300;

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
    // 获取或创建课程
    // ============================================
    const { courseId } = await resolveInterviewState(
      userId,
      inputCourseId,
      messages as UIMessage[],
    );

    // ============================================
    // 创建 Agent（每步从 DB 读取最新 profile）
    // ============================================
    const agent = createInterviewAgent({
      userId,
      courseId,
      messages: messages as UIMessage[],
    });

    const response = await createNexusNoteStreamResponse(agent, messages as UIMessage[], {
      sessionId,
      resourceId: courseId,
    });

    const durationMs = Date.now() - startTime;
    console.log("[Interview]", { durationMs, courseId });

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
  inputCourseId: string | null | undefined,
  messages: UIMessage[],
): Promise<{ courseId: string }> {
  // 1. 尝试获取现有课程
  if (inputCourseId) {
    const existing = await db.query.courseSessions.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, inputCourseId!), eq(c.userId, userId)),
      columns: { id: true },
    });

    if (existing) {
      return { courseId: existing.id };
    }
  }

  // 2. 创建新课程，初始 profile 为空
  const firstUserMessage = messages.find((m) => m.role === "user");
  let initialGoal: string | null = null;

  if (firstUserMessage?.parts) {
    const textPart = firstUserMessage.parts.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      initialGoal = textPart.text.slice(0, 200);
    }
  }

  const initialProfile: InterviewProfile = {
    goal: initialGoal,
    background: null,
    outcome: null,
  };

  const [newCourse] = await db
    .insert(courseSessions)
    .values({
      userId,
      title: initialGoal ?? "新课程",
      interviewProfile: initialProfile satisfies InterviewProfile,
      interviewStatus: "interviewing",
      status: "idle",
    })
    .returning();

  console.log("[Interview] Created course:", newCourse.id);

  return { courseId: newCourse.id };
}

// ============================================
// Health Check
// ============================================

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}

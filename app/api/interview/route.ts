// app/api/interview/route.ts

import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { courses, db } from "@/db";
import {
  aiProvider,
  createTelemetryContext,
  getAgent,
  getErrorMessage,
  InterviewApiRequestSchema,
  recordAIUsage,
} from "@/lib/ai";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let telemetry = createTelemetryContext({
    requestId,
    endpoint: "/api/interview",
    profile: "INTERVIEW",
    promptVersion: "interview@v1",
    modelPolicy: "interactive-fast",
  });

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

    const validation = InterviewApiRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: validation.error.issues } },
        { status: 400 },
      );
    }

    const { messages, sessionId, courseId: inputCourseId } = validation.data;
    telemetry = createTelemetryContext({
      requestId,
      endpoint: "/api/interview",
      userId,
      profile: "INTERVIEW",
      promptVersion: "interview@v1",
      modelPolicy: "interactive-fast",
      metadata: {
        sessionId: sessionId ?? null,
        courseId: inputCourseId ?? null,
      },
    });

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    let courseId: string | undefined;
    if (inputCourseId) {
      const [existingCourse] = await db
        .select({ id: courses.id, userId: courses.userId })
        .from(courses)
        .where(eq(courses.id, inputCourseId))
        .limit(1);

      if (!existingCourse || existingCourse.userId !== userId) {
        throw new APIError("课程不存在", 404, "NOT_FOUND");
      }

      courseId = existingCourse.id;
    }

    const agent = await getAgent("INTERVIEW", {
      userId,
      courseId,
      messages: messages as UIMessage[],
      telemetry,
    });

    const response = await createNexusNoteStreamResponse(agent, messages as UIMessage[], {
      sessionId,
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });

    const response = handleError(error);
    response.headers.set("X-Request-Id", requestId);
    return response;
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}

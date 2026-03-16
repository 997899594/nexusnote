// app/api/interview/route.ts

import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { courseSessions, db } from "@/db";
import { aiProvider, validateRequest } from "@/lib/ai";
import { createInterviewAgent } from "@/lib/ai/agents/interview";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
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

    const { courseId } = await resolveOrCreateCourse(
      userId,
      inputCourseId,
      messages as UIMessage[],
    );

    const agent = createInterviewAgent({
      userId,
      courseId,
      messages: messages as UIMessage[],
    });

    const response = await createNexusNoteStreamResponse(agent, messages as UIMessage[], {
      sessionId,
      resourceId: courseId,
    });

    return response;
  } catch (error) {
    return handleError(error);
  }
}

async function resolveOrCreateCourse(
  userId: string,
  inputCourseId: string | null | undefined,
  messages: UIMessage[],
): Promise<{ courseId: string }> {
  if (inputCourseId) {
    const existing = await db.query.courseSessions.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, inputCourseId), eq(c.userId, userId)),
      columns: { id: true },
    });

    if (existing) {
      return { courseId: existing.id };
    }
  }

  // Extract title from first user message
  const firstUserMessage = messages.find((m) => m.role === "user");
  let title = "新课程";

  if (firstUserMessage?.parts) {
    const textPart = firstUserMessage.parts.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      title = textPart.text.slice(0, 100);
    }
  }

  const [newCourse] = await db
    .insert(courseSessions)
    .values({
      userId,
      title,
      interviewStatus: "interviewing",
      status: "idle",
    })
    .returning();

  return { courseId: newCourse.id };
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}

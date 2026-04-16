import { validateUIMessages } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import {
  aiProvider,
  classifyAIDegradation,
  createInterviewAgent,
  createTelemetryContext,
  getErrorMessage,
  InterviewApiRequestSchema,
  type InterviewUIMessage,
  recordAIUsage,
} from "@/lib/ai";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getUserGrowthContext } from "@/lib/growth/generation-context";
import { getOwnedCourse } from "@/lib/learning/course-repository";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let telemetry = createTelemetryContext({
    requestId,
    endpoint: "/api/interview",
    promptVersion: "interview@agent-v1",
    modelPolicy: "interactive-fast",
    workflow: "interview-agent",
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

    const { messages, sessionId, courseId: inputCourseId, outline } = validation.data;
    telemetry = createTelemetryContext({
      requestId,
      endpoint: "/api/interview",
      userId,
      promptVersion: "interview@agent-v1",
      modelPolicy: "interactive-fast",
      workflow: "interview-agent",
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
      const existingCourse = await getOwnedCourse(inputCourseId, userId);
      if (!existingCourse) {
        throw new APIError("课程不存在", 404, "NOT_FOUND");
      }

      courseId = existingCourse.id;
    }

    const generationContext = await getUserGrowthContext(userId);

    const validatedMessages = await validateUIMessages<InterviewUIMessage>({ messages });

    const agent = createInterviewAgent({
      userId,
      courseId,
      currentOutline: outline ?? undefined,
      messages: validatedMessages,
      generationContext,
      telemetry,
    });

    const response = await createNexusNoteStreamResponse(agent, validatedMessages, {
      sessionId,
      presentation: "interview",
      sendReasoning: false,
    });
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    const degradation = classifyAIDegradation(error);
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });

    const response = handleError(error);
    response.headers.set("X-Request-Id", requestId);
    if (degradation) {
      response.headers.set("X-AI-Degraded", degradation.kind);
    }
    return response;
  }
}

export async function GET() {
  const providerStatus = aiProvider.getStatus();
  return NextResponse.json({
    status: "ok",
    ai: {
      configured: aiProvider.isConfigured(),
      primaryProvider: providerStatus.primaryProvider,
      providers: providerStatus.providers,
    },
    timestamp: new Date().toISOString(),
  });
}

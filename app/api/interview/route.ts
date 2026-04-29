import { validateUIMessages } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { createInterviewSessionAgent } from "@/lib/ai/agents/interview-session";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { aiProvider } from "@/lib/ai/core/provider";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import type { InterviewUIMessage } from "@/lib/ai/interview/ui";
import { InterviewApiRequestSchema } from "@/lib/ai/validation";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getUserGrowthContextWithinBudget } from "@/lib/growth/generation-context";
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

    const { messages, sessionId, courseId: inputCourseId, outline, mode } = validation.data;
    const modelPolicy = outline ? "outline-architect" : "interactive-fast";
    const promptVersion = mode === "structured" ? "interview@structured-v2" : "interview@agent-v1";
    const workflow = mode === "structured" ? "interview-agent-structured" : "interview-agent";
    telemetry = createTelemetryContext({
      requestId,
      endpoint: "/api/interview",
      userId,
      promptVersion,
      modelPolicy,
      workflow,
      metadata: {
        sessionId: sessionId ?? null,
        courseId: inputCourseId ?? null,
        ...(mode === "structured" ? { sessionMode: mode } : {}),
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

    const generationContext = await getUserGrowthContextWithinBudget(userId, {
      onTimeout: () => {
        console.warn("[Interview] Growth context missed interactive budget", {
          requestId,
          userId,
        });
      },
    });

    const validatedMessages = await validateUIMessages<InterviewUIMessage>({ messages });

    const agent = await createInterviewSessionAgent({
      userId,
      courseId,
      currentOutline: outline ?? undefined,
      messages: validatedMessages,
      mode,
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
    void recordAIUsage({
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

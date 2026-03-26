import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  smoothStream,
  validateUIMessages,
} from "ai";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { courses, db } from "@/db";
import {
  aiProvider,
  createInterviewAgent,
  createTelemetryContext,
  findLatestOutline,
  generateInterviewOptions,
  getErrorMessage,
  getInterviewMessageText,
  InterviewApiRequestSchema,
  InterviewOptionsDataSchema,
  type InterviewUIMessage,
  recordAIUsage,
} from "@/lib/ai";
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

    const validatedMessages = await validateUIMessages<InterviewUIMessage>({
      messages,
      dataSchemas: {
        interviewOptions: InterviewOptionsDataSchema,
      },
    });

    const agent = createInterviewAgent({
      userId,
      courseId,
      currentOutline: outline ?? undefined,
      messages: validatedMessages,
      telemetry,
    });

    const modelMessages = await convertToModelMessages(validatedMessages, {
      tools: agent.tools,
    });

    const stream = createUIMessageStream<InterviewUIMessage>({
      originalMessages: validatedMessages,
      execute: async ({ writer }) => {
        let finishStateResolve:
          | ((value: { messages: InterviewUIMessage[]; finishReason?: FinishReason }) => void)
          | null = null;
        const finishStatePromise = new Promise<{
          messages: InterviewUIMessage[];
          finishReason?: FinishReason;
        }>((resolve) => {
          finishStateResolve = resolve;
        });

        const result = await agent.stream({
          prompt: modelMessages,
          experimental_transform: smoothStream({
            chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
          }),
        });

        writer.merge(
          result.toUIMessageStream<InterviewUIMessage>({
            originalMessages: validatedMessages,
            sendReasoning: false,
            sendFinish: false,
            onFinish: ({ messages: finishedMessages, finishReason }) => {
              finishStateResolve?.({
                messages: finishedMessages,
                finishReason,
              });
            },
          }),
        );

        const { messages: finishedMessages, finishReason } = await finishStatePromise;
        const latestAssistantMessage = [...finishedMessages]
          .reverse()
          .find((message) => message.role === "assistant");
        const assistantText = latestAssistantMessage
          ? getInterviewMessageText(latestAssistantMessage)
          : "";
        const latestOutline = findLatestOutline(finishedMessages);

        if (assistantText) {
          try {
            const options = await generateInterviewOptions({
              messages: finishedMessages,
              assistantText,
              hasOutline: Boolean(latestOutline?.outline),
            });

            if (options.length > 0) {
              writer.write({
                type: "data-interviewOptions",
                data: { options },
              });
            }
          } catch (error) {
            console.warn("[Interview] Failed to generate options:", error);
          }
        }

        writer.write({
          type: "finish",
          finishReason: finishReason ?? "stop",
        });
      },
      onError: (error) => getErrorMessage(error),
    });

    return createUIMessageStreamResponse({
      stream,
      status: 200,
      headers: {
        "X-Request-Id": requestId,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      },
    });
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
  const providerStatus = aiProvider.getStatus();
  return NextResponse.json({
    status: "ok",
    ai: {
      configured: aiProvider.isConfigured(),
      primaryProvider: providerStatus.primaryProvider,
      providers: providerStatus.providers,
      fallbackEnabled: providerStatus.fallbackEnabled,
    },
    timestamp: new Date().toISOString(),
  });
}

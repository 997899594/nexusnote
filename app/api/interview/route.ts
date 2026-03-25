// app/api/interview/route.ts

import { consumeStream, type DeepPartial } from "ai";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { courses, db } from "@/db";
import {
  aiProvider,
  createTelemetryContext,
  getErrorMessage,
  InterviewApiRequestSchema,
  recordAIUsage,
} from "@/lib/ai";
import {
  generateInterviewTurn,
  type InterviewStreamEvent,
  type InterviewTurn,
  normalizeInterviewTurn,
  normalizePartialInterviewTurn,
} from "@/lib/ai/interview";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const encoder = new TextEncoder();

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: InterviewStreamEvent,
) {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let telemetry = createTelemetryContext({
    requestId,
    endpoint: "/api/interview",
    promptVersion: "interview@v1",
    modelPolicy: "structured-high-quality",
    workflow: "interview-turn",
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
      promptVersion: "interview@v1",
      modelPolicy: "structured-high-quality",
      workflow: "interview-turn",
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

    const result = generateInterviewTurn({
      messages,
      currentOutline: outline ?? undefined,
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const partial of result.partialOutputStream) {
            const turn = normalizePartialInterviewTurn(partial as DeepPartial<InterviewTurn>);
            if (!turn) {
              continue;
            }

            writeEvent(controller, {
              type: "turn-delta",
              turn,
            });
          }

          const finalTurn = normalizeInterviewTurn(await result.output);
          let generatedCourseId: string | undefined;

          if (finalTurn.kind === "outline") {
            const workflowResult = await runCreateCourseWorkflow({
              userId,
              courseId,
              outline: finalTurn.outline,
            });
            generatedCourseId = workflowResult.courseId;
          }

          await recordAIUsage({
            ...telemetry,
            usage: await result.usage,
            durationMs: Date.now() - startedAt,
            success: true,
            metadata: {
              ...telemetry.metadata,
              kind: finalTurn.kind,
              optionCount: finalTurn.options.length,
              generatedCourseId: generatedCourseId ?? null,
            },
          });

          writeEvent(controller, {
            type: "turn-complete",
            turn: finalTurn,
            courseId: generatedCourseId,
          });
          controller.close();
        } catch (error) {
          await consumeStream({ stream: result.textStream }).catch(() => {});
          await recordAIUsage({
            ...telemetry,
            durationMs: Date.now() - startedAt,
            success: false,
            errorMessage: getErrorMessage(error),
          });

          writeEvent(controller, {
            type: "error",
            error: getErrorMessage(error),
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
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

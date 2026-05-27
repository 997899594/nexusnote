import { validateUIMessages } from "ai";
import type { NextRequest } from "next/server";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { aiModelGateway } from "@/lib/ai/core/model-gateway";
import { getUserAIModelSeries } from "@/lib/ai/core/model-series-preferences";
import { createNexusNoteStreamResponse } from "@/lib/ai/core/streaming";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import type { InterviewUIMessage } from "@/lib/ai/interview/ui";
import { resolveInterviewWebResearchContext } from "@/lib/ai/interview/web-research-context";
import { createCourseInterviewerSpecialistAgent } from "@/lib/ai/specialists/registry";
import { InterviewApiRequestSchema } from "@/lib/ai/validation";
import {
  handleError,
  notFound,
  parseJsonBodyAs,
  serviceUnavailable,
  unauthorized,
} from "@/lib/api";
import { auth } from "@/lib/auth";
import { getOwnedCourse } from "@/lib/learning/course-repository";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  let telemetry = createTelemetryContext({
    requestId,
    endpoint: "/api/interview",
    promptVersion: "interview@agent-v1",
    modelPolicy: "outline-architect",
    workflow: "interview-agent",
  });

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw unauthorized("请先登录");
    }

    const {
      messages,
      sessionId,
      courseId: inputCourseId,
      outline,
    } = await parseJsonBodyAs(request, InterviewApiRequestSchema);
    const modelPolicy = "outline-architect";
    const promptVersion = "interview@agent-v1";
    const workflow = "interview-agent";
    const modelSeries = await getUserAIModelSeries(userId);
    telemetry = createTelemetryContext({
      requestId,
      endpoint: "/api/interview",
      userId,
      promptVersion,
      modelPolicy,
      modelSeries,
      workflow,
      metadata: {
        sessionId: sessionId ?? null,
        courseId: inputCourseId ?? null,
        modelSeries,
      },
    });

    if (!aiModelGateway.isConfigured()) {
      throw serviceUnavailable("助手服务暂时不可用", "AI_NOT_CONFIGURED");
    }

    let courseId: string | undefined;
    if (inputCourseId) {
      const existingCourse = await getOwnedCourse(inputCourseId, userId);
      if (!existingCourse) {
        throw notFound("课程不存在", "COURSE_NOT_FOUND");
      }

      courseId = existingCourse.id;
    }

    const validatedMessages = await validateUIMessages<InterviewUIMessage>({ messages });
    const webResearchContext = await resolveInterviewWebResearchContext({
      userId,
      messages: validatedMessages,
    });
    telemetry = {
      ...telemetry,
      metadata: {
        ...telemetry.metadata,
        evidenceRequired: Boolean(webResearchContext.evidenceRequest),
        evidenceDomain: webResearchContext.evidenceRequest?.domain ?? null,
        evidenceReasons: webResearchContext.evidenceRequest?.reasonCodes ?? [],
        evidenceAvailable: webResearchContext.evidenceAvailable,
        evidenceSourceCount: webResearchContext.retrieval?.sources.length ?? 0,
      },
    };

    const agent = createCourseInterviewerSpecialistAgent({
      userId,
      courseId,
      currentOutline: outline ?? undefined,
      messages: validatedMessages,
      webResearchContext,
      modelSeries,
      telemetry,
    });

    const response = await createNexusNoteStreamResponse(agent, validatedMessages, {
      sessionId,
      presentation: "interview",
      sendReasoning: false,
      dataParts: webResearchContext.evidenceSnapshot
        ? [
            {
              type: "data-researchEvidence",
              id: webResearchContext.evidenceSnapshot.id,
              data: webResearchContext.evidenceSnapshot,
            },
          ]
        : undefined,
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
  const aiStatus = aiModelGateway.getStatus();
  return Response.json({
    status: "ok",
    ai: {
      configured: aiStatus.configured,
    },
    timestamp: new Date().toISOString(),
  });
}

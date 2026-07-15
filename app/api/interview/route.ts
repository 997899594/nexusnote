import type { NextRequest } from "next/server";
import { db } from "@/db";
import { parseConversationRequest } from "@/lib/ai/conversation-input";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { aiModelGateway } from "@/lib/ai/core/model-gateway";
import { getUserAIModelSeries } from "@/lib/ai/core/model-series-preferences";
import {
  createNexusNoteDeferredStreamResponse,
  streamAgentIntoWriter,
} from "@/lib/ai/core/streaming";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  createInterviewResearchCompletedEvent,
  createInterviewResearchProgressEvent,
  createInterviewResearchRunId,
  createInterviewResearchStartedEvent,
} from "@/lib/ai/interview/research-events";
import type { InterviewUIMessage } from "@/lib/ai/interview/ui";
import { resolveInterviewWebResearchContext } from "@/lib/ai/interview/web-research-context";
import { createCourseInterviewerSpecialistAgent } from "@/lib/ai/specialists/registry";
import { type InterviewApiRequest, InterviewApiRequestSchema } from "@/lib/ai/validation";
import { handleError, notFound, serviceUnavailable, unauthorized } from "@/lib/api";
import { checkRateLimitOrThrow } from "@/lib/api/rate-limit";
import { auth } from "@/lib/auth";
import { consumeCapabilityAllowance } from "@/lib/billing/capability-access";
import { AI_CAPABILITIES, canUseAICapability } from "@/lib/billing/capability-policy";
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

    const { input, messages, estimatedTokens } = await parseConversationRequest<
      InterviewApiRequest,
      InterviewUIMessage
    >(request, InterviewApiRequestSchema);
    const { sessionId, courseId: inputCourseId, outline } = input;
    const modelPolicy = "outline-architect";
    const promptVersion = "interview@agent-v1";
    const workflow = "interview-agent";
    const [modelSeries, researchEnabled] = await Promise.all([
      getUserAIModelSeries(userId),
      canUseAICapability(userId, AI_CAPABILITIES.research),
    ]);
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
        requestEstimatedTokens: estimatedTokens,
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

    const validatedMessages = messages;
    const response = createNexusNoteDeferredStreamResponse({
      originalMessages: validatedMessages,
      sessionId,
      execute: async ({ writer, writeData }) => {
        const researchRunId = createInterviewResearchRunId();
        const webResearchContext = await resolveInterviewWebResearchContext({
          userId,
          messages: validatedMessages,
          modelSeries,
          enabled: researchEnabled,
          onRequest: async (evidenceRequest) => {
            await checkRateLimitOrThrow(
              `research:${userId}`,
              20,
              60 * 60 * 1000,
              "研究请求过于频繁，请稍后再试",
              { failureMode: "deny" },
            );
            await db.transaction((tx) =>
              consumeCapabilityAllowance(tx, {
                userId,
                capability: AI_CAPABILITIES.research,
                consumptionKey: `interview-research:${researchRunId}`,
                metadata: {
                  runId: researchRunId,
                  source: "course_interview",
                  query: evidenceRequest.query,
                },
              }),
            );
            writeData({
              type: "data-researchEvent",
              id: `${researchRunId}-started`,
              data: createInterviewResearchStartedEvent({
                runId: researchRunId,
                query: evidenceRequest.query,
                queries: evidenceRequest.queries,
                freshnessWindowDays: evidenceRequest.freshnessWindowDays,
              }),
            });
          },
          onProgress: (progress) => {
            writeData({
              type: "data-researchEvent",
              id: `${researchRunId}-${progress.stage}`,
              data: createInterviewResearchProgressEvent({
                runId: researchRunId,
                progress,
              }),
            });
          },
        });

        telemetry = {
          ...telemetry,
          metadata: {
            ...telemetry.metadata,
            evidenceRequired: Boolean(webResearchContext.evidenceRequest),
            evidenceDomain: webResearchContext.evidenceRequest?.domain ?? null,
            evidenceReasons: webResearchContext.evidenceRequest?.reasonCodes ?? [],
            evidenceDecisionSource: webResearchContext.evidenceRequest?.decisionSource ?? null,
            evidenceAvailable: webResearchContext.evidenceAvailable,
            evidenceSourceCount: webResearchContext.retrieval?.sources.length ?? 0,
          },
        };

        if (webResearchContext.evidenceSnapshot) {
          writeData({
            type: "data-researchEvent",
            id: `${researchRunId}-completed`,
            data: createInterviewResearchCompletedEvent({
              runId: researchRunId,
              evidence: webResearchContext.evidenceSnapshot,
            }),
          });
          writeData({
            type: "data-researchEvidence",
            id: webResearchContext.evidenceSnapshot.id,
            data: webResearchContext.evidenceSnapshot,
          });
        }

        const agent = createCourseInterviewerSpecialistAgent({
          userId,
          courseId,
          currentOutline: outline ?? undefined,
          messages: validatedMessages,
          webResearchContext,
          modelSeries,
          telemetry,
        });

        await streamAgentIntoWriter({
          writer,
          agent,
          messages: validatedMessages,
          presentation: "interview",
          sendReasoning: false,
          observability: { endpoint: "/api/interview", startedAt },
        });
      },
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

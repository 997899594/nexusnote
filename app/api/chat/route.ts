/**
 * AI Chat API - 2026 Modern Architecture
 *
 * 2026 架构：
 * - Context Resolver -> Intent Router -> Route Arbiter -> Specialist
 * - Interview / workflow 请求不在普通 chat specialist 内直接执行
 * - 无人设式混杂语义
 */

import type { UIMessage } from "ai";
import { after, type NextRequest } from "next/server";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { aiModelGateway } from "@/lib/ai/core/model-gateway";
import { getUserAIModelSeries } from "@/lib/ai/core/model-series-preferences";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { extractUIMessageText } from "@/lib/ai/message-text";
import {
  createBackgroundResearchHandoffResponse,
  shouldStartBackgroundResearchWorkflow,
} from "@/lib/ai/runtime/chat-research-handoff";
import {
  buildChatPersonalizationContext,
  createChatStreamResponse,
  getPersistableConversationMetadata,
  touchChatConversation,
} from "@/lib/ai/runtime/chat-session";
import { orchestrateRequest } from "@/lib/ai/runtime/orchestrate-request";
import { resolveRequestContext } from "@/lib/ai/runtime/resolve-request-context";
import {
  AI_EXECUTION_MODE_HEADER,
  AI_HANDOFF_TARGET_HEADER,
} from "@/lib/ai/runtime/response-headers";
import {
  createConversationSpecialistAgent,
  getConversationSpecialistSpec,
} from "@/lib/ai/specialists/registry";
import { ChatApiRequestSchema } from "@/lib/ai/validation";
import { handleError, parseJsonBodyAs, serviceUnavailable, unauthorized } from "@/lib/api";
import { checkRateLimitOrThrow } from "@/lib/api/rate-limit";
import { auth } from "@/lib/auth";
import {
  buildCareerMapDraftFromWorkspaceData,
  getCareerPlanningWorkspaceDataFresh,
} from "@/lib/career-planning/workspace-data";
import { isCareerRequestMetadata } from "@/types/request-metadata";

export const maxDuration = 300;

function getLatestUserMessageText(messages: UIMessage[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return latestUserMessage ? extractUIMessageText(latestUserMessage) : "";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  let telemetry = createTelemetryContext({
    requestId,
    endpoint: "/api/chat",
  });

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw unauthorized("请先登录");
    }

    // Rate Limiting
    await checkRateLimitOrThrow(userId, 100, 60 * 1000, "请求过于频繁，请稍后再试");

    const { messages, sessionId, skinSlug, courseId, metadata } = await parseJsonBodyAs(
      request,
      ChatApiRequestSchema,
    );

    const uiMessages = messages as UIMessage[];
    const modelSeries = await getUserAIModelSeries(userId);
    const requestContext = await resolveRequestContext({
      userId,
      messages: uiMessages,
      sessionId: sessionId ?? null,
      courseId,
      metadata,
      modelSeries,
      skinSlug,
    });
    const routeDecision = await orchestrateRequest({
      userId,
      messages: uiMessages,
      requestContext,
    });
    const specialist = getConversationSpecialistSpec(routeDecision.resolvedCapabilityMode);
    const resolvedCourseId = requestContext.resourceContext.courseId;
    const resolvedMetadata = requestContext.metadata;
    const persistableConversationMetadata = getPersistableConversationMetadata(resolvedMetadata);
    const learningGuidance = requestContext.learningGuidance;
    telemetry = createTelemetryContext({
      requestId,
      endpoint: "/api/chat",
      userId,
      intent: routeDecision.intent,
      capabilityMode: routeDecision.resolvedCapabilityMode,
      promptVersion: specialist.promptKey,
      modelPolicy: specialist.modelPolicy,
      modelSeries,
      metadata: {
        sessionId: sessionId ?? null,
        courseId: resolvedCourseId ?? null,
        documentId: requestContext.resourceContext.documentId ?? null,
        chapterIndex: requestContext.resourceContext.chapterIndex ?? null,
        sectionIndex: requestContext.resourceContext.sectionIndex ?? null,
        surface: requestContext.surface,
        context: resolvedMetadata?.context ?? null,
        hasLearningGuidance: requestContext.hasLearningGuidance,
        hasCareerTreeSnapshot: requestContext.hasCareerTreeSnapshot,
        recentMessageCount: requestContext.recentMessages.length,
        modelSeries,
        requestedCapabilityMode: routeDecision.capabilityMode,
        resolvedCapabilityMode: routeDecision.resolvedCapabilityMode,
        executionMode: routeDecision.executionMode,
        handoffTarget: routeDecision.handoffTarget,
        routeConfidence: routeDecision.confidence,
        routeReasons: routeDecision.reasons,
        arbiterNotes: routeDecision.arbiterNotes,
      },
    });

    if (!aiModelGateway.isConfigured()) {
      throw serviceUnavailable("助手服务暂时不可用", "AI_NOT_CONFIGURED");
    }

    const { behaviorPrompt, skinPrompt, userContext } = await buildChatPersonalizationContext({
      userId,
      sessionId,
      skinSlug,
      assistantInstruction: routeDecision.assistantInstruction,
    });

    await touchChatConversation({
      userId,
      sessionId,
      messages: uiMessages,
      metadata: persistableConversationMetadata,
    });

    if (
      shouldStartBackgroundResearchWorkflow({
        executionMode: routeDecision.executionMode,
        handoffTarget: routeDecision.handoffTarget,
      })
    ) {
      return createBackgroundResearchHandoffResponse({
        userId,
        sessionId,
        messages: uiMessages,
        modelSeries,
        routeDecision,
        requestId,
      });
    }

    const agent = await createConversationSpecialistAgent({
      mode: routeDecision.resolvedCapabilityMode,
      options: {
        userId,
        behaviorPrompt,
        skinPrompt,
        userContext,
        learningGuidance,
        courseId: resolvedCourseId,
        metadata: resolvedMetadata,
        modelSeries,
        telemetry,
      },
    });
    const careerMapDraft =
      isCareerRequestMetadata(resolvedMetadata) && resolvedMetadata.entry === "planning"
        ? buildCareerMapDraftFromWorkspaceData({
            data: await getCareerPlanningWorkspaceDataFresh(userId),
            latestUserMessage: getLatestUserMessageText(uiMessages),
          })
        : null;

    const response = await createChatStreamResponse({
      agent,
      messages: uiMessages,
      userId,
      sessionId,
      scheduleAfter: after,
      dataParts: careerMapDraft
        ? [
            {
              type: "data-careerMapDraft",
              id: `career-map-draft-${requestId}`,
              data: careerMapDraft,
            },
          ]
        : undefined,
    });
    response.headers.set("X-Request-Id", requestId);
    response.headers.set(AI_EXECUTION_MODE_HEADER, routeDecision.executionMode);
    response.headers.set(AI_HANDOFF_TARGET_HEADER, routeDecision.handoffTarget ?? "");

    return response;
  } catch (error) {
    const degradation = classifyAIDegradation(error);
    void recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startTime,
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

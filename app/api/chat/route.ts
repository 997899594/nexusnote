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
import type { RouteDecision } from "@/lib/ai/runtime/contracts";
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
  AI_CAPABILITIES,
  assertAICapabilityAccess,
  canUseAICapability,
} from "@/lib/billing/capability-policy";

export const maxDuration = 300;

function escapePromptXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function formatLearnSelectionContext(
  selectionContext:
    | {
        text: string;
        chapterIndex: number;
        sectionIndex: number;
        chapterTitle?: string;
        sectionTitle?: string;
      }
    | undefined,
): string | null {
  if (!selectionContext) {
    return null;
  }

  return [
    "## 用户当前划线引用",
    `位置：第 ${selectionContext.chapterIndex + 1} 章，第 ${selectionContext.sectionIndex + 1} 节`,
    selectionContext.chapterTitle ? `章节标题：${selectionContext.chapterTitle}` : "",
    selectionContext.sectionTitle ? `小节标题：${selectionContext.sectionTitle}` : "",
    "用户接下来这条消息优先围绕下面这段划线内容回答；如果问题没有明说，就解释这段内容在当前小节中的意思、作用和容易误解的点。",
    "<quoted_selection>",
    escapePromptXml(selectionContext.text),
    "</quoted_selection>",
  ]
    .filter(Boolean)
    .join("\n");
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

    const { messages, sessionId, skinSlug, courseId, metadata, learnSelectionContext } =
      await parseJsonBodyAs(request, ChatApiRequestSchema);

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
    const routeDecision: RouteDecision =
      learnSelectionContext &&
      requestContext.surface === "learn" &&
      requestContext.hasLearningGuidance
        ? {
            intent: "learn_explanation" as const,
            capabilityMode: "learn_coach" as const,
            resolvedCapabilityMode: "learn_coach" as const,
            executionMode: "tool_loop" as const,
            requiredScopes: ["course"],
            confidence: 1,
            reasons: ["learn selection context supplied by course reader"],
            handoffTarget: null,
            arbiterNotes: ["learn selection context pins this request to learn_coach"],
            assistantInstruction: null,
          }
        : await orchestrateRequest({
            userId,
            messages: uiMessages,
            requestContext,
          });

    const researchRequested =
      routeDecision.resolvedCapabilityMode === "research_assistant" ||
      routeDecision.requiredScopes.includes("web");
    const researchEnabled = await canUseAICapability(userId, AI_CAPABILITIES.research);

    if (researchRequested) {
      assertAICapabilityAccess(AI_CAPABILITIES.research, researchEnabled);
      await checkRateLimitOrThrow(
        `research:${userId}`,
        20,
        60 * 60 * 1000,
        "研究请求过于频繁，请稍后再试",
        { failureMode: "deny" },
      );
    }

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
        hasLearnSelectionContext: Boolean(learnSelectionContext),
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
    const requestUserContext = [userContext, formatLearnSelectionContext(learnSelectionContext)]
      .filter(Boolean)
      .join("\n\n");

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
        userContext: requestUserContext,
        learningGuidance,
        courseId: resolvedCourseId,
        metadata: resolvedMetadata,
        modelSeries,
        telemetry,
        researchEnabled,
      },
    });
    const response = await createChatStreamResponse({
      agent,
      messages: uiMessages,
      userId,
      sessionId,
      scheduleAfter: after,
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

/**
 * AI Chat API - 2026 Modern Architecture
 *
 * 2026 架构：
 * - Context Resolver -> Intent Router -> Route Arbiter -> Specialist
 * - Interview / workflow 请求不在普通 chat specialist 内直接执行
 * - 无人设式混杂语义
 */

import type { UIMessage } from "ai";
import { after, type NextRequest, NextResponse } from "next/server";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { aiProvider } from "@/lib/ai/core/provider";
import { getChatResumableStreamContext } from "@/lib/ai/core/resumable-streams";
import { getUserAIRouteProfile } from "@/lib/ai/core/route-profile-preferences";
import {
  createNexusNoteStreamResponse,
  createStaticAssistantMessageResponse,
} from "@/lib/ai/core/streaming";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { buildPersonalization } from "@/lib/ai/personalization";
import {
  buildResearchRunMetadata,
  createResearchRun,
  failResearchRun,
  markResearchRunQueued,
} from "@/lib/ai/research/store";
import { orchestrateRequest } from "@/lib/ai/runtime/orchestrate-request";
import { resolveRequestContext } from "@/lib/ai/runtime/resolve-request-context";
import {
  AI_EXECUTION_MODE_HEADER,
  AI_HANDOFF_TARGET_HEADER,
  AI_WORKFLOW_JOB_ID_HEADER,
  AI_WORKFLOW_JOB_TYPE_HEADER,
} from "@/lib/ai/runtime/response-headers";
import {
  createConversationSpecialistAgent,
  getConversationSpecialistSpec,
} from "@/lib/ai/specialists/registry";
import { ChatApiRequestSchema } from "@/lib/ai/validation";
import { APIError, handleError } from "@/lib/api";
import { checkRateLimitOrThrow } from "@/lib/api/rate-limit";
import { auth } from "@/lib/auth";
import { syncConversationKnowledge } from "@/lib/chat/conversation-knowledge";
import { buildConversationMemoryContext } from "@/lib/chat/conversation-memory";
import {
  getConversationActiveStreamId,
  persistConversationMessages,
  setConversationActiveStreamId,
} from "@/lib/chat/conversation-persistence";
import {
  ConversationUnavailableError,
  getOwnedConversationSummary,
  mergeOwnedConversationMetadata,
  touchOwnedConversation,
} from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";
import { enqueueBackgroundResearch, type QueuedResearchJob } from "@/lib/queue/research-queue";
import type { RequestMetadata } from "@/types/request-metadata";

export const maxDuration = 300;

function appendContextBlock(base: string, block: string | null | undefined): string {
  return [base, block].filter(Boolean).join("\n\n");
}

function shouldStartBackgroundResearchWorkflow(params: {
  executionMode: string;
  handoffTarget: string | null;
}) {
  return params.executionMode === "workflow" && params.handoffTarget === "research_assistant";
}

function getLatestUserMessageText(messages: UIMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return latestUserMessage ? extractUIMessageText(latestUserMessage).trim() : "";
}

function buildAssistantTextMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

function getPersistableConversationMetadata(
  metadata: RequestMetadata | undefined,
): Record<string, unknown> | undefined {
  if (!metadata?.context || metadata.context === "default") {
    return undefined;
  }

  return metadata;
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
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    // Rate Limiting
    await checkRateLimitOrThrow(userId, 100, 60 * 1000, "请求过于频繁，请稍后再试");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new APIError("无效的 JSON", 400, "INVALID_JSON");
    }

    const validation = ChatApiRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: validation.error.issues } },
        { status: 400 },
      );
    }

    const { messages, sessionId, skinSlug, courseId, metadata } = validation.data;

    const uiMessages = messages as UIMessage[];
    const routeProfile = await getUserAIRouteProfile(userId);
    const requestContext = await resolveRequestContext({
      userId,
      messages: uiMessages,
      sessionId: sessionId ?? null,
      courseId,
      metadata,
      routeProfile,
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
      routeProfile,
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
        routeProfile,
        requestedCapabilityMode: routeDecision.capabilityMode,
        resolvedCapabilityMode: routeDecision.resolvedCapabilityMode,
        executionMode: routeDecision.executionMode,
        handoffTarget: routeDecision.handoffTarget,
        routeConfidence: routeDecision.confidence,
        routeReasons: routeDecision.reasons,
        arbiterNotes: routeDecision.arbiterNotes,
      },
    });

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // Personalization: Load behavior policy, skin, context
    // ============================================

    let behaviorPrompt = "";
    let skinPrompt = "";
    let userContext = "";

    if (userId) {
      const {
        behaviorPrompt: personalizationBehaviorPrompt,
        skinPrompt: personalizationSkinPrompt,
        userContext: context,
      } = await buildPersonalization(userId, { skinSlug });
      behaviorPrompt = personalizationBehaviorPrompt;
      skinPrompt = personalizationSkinPrompt;
      userContext = context;
    }

    const hasPersistentSession = Boolean(sessionId && userId && isUuidString(sessionId));
    let ownedConversationSummary: string | null = null;

    if (hasPersistentSession && sessionId) {
      ownedConversationSummary = await getOwnedConversationSummary(sessionId, userId);

      const memoryContext = buildConversationMemoryContext(ownedConversationSummary);
      if (memoryContext) {
        userContext = [userContext, memoryContext].filter(Boolean).join("\n\n");
      }
    }

    userContext = appendContextBlock(
      userContext,
      routeDecision.assistantInstruction
        ? `## 本轮路由约束\n${routeDecision.assistantInstruction}`
        : null,
    );

    // upsert conversation
    if (sessionId && userId && isUuidString(sessionId)) {
      const firstUserMessage = uiMessages.find((m) => m.role === "user");
      let title = "新对话";

      if (firstUserMessage?.parts) {
        const textPart = firstUserMessage.parts.find((p) => p.type === "text");
        if (textPart && "text" in textPart) {
          title = textPart.text.slice(0, 100);
        }
      }

      try {
        await touchOwnedConversation({
          conversationId: sessionId,
          userId,
          title,
          messageCount: uiMessages.length,
          intent: "CHAT",
        });
        if (persistableConversationMetadata) {
          await mergeOwnedConversationMetadata({
            conversationId: sessionId,
            userId,
            metadataPatch: persistableConversationMetadata,
          });
        }
      } catch (error) {
        if (error instanceof ConversationUnavailableError) {
          throw new APIError("会话不存在或无权访问", 404, "NOT_FOUND");
        }

        console.warn("[ChatSession] Failed to upsert session:", error);
      }
    } else if (sessionId && !isUuidString(sessionId)) {
      console.warn("[ChatSession] Skip upsert for non-UUID sessionId:", sessionId);
    }

    if (
      shouldStartBackgroundResearchWorkflow({
        executionMode: routeDecision.executionMode,
        handoffTarget: routeDecision.handoffTarget,
      })
    ) {
      const latestUserMessageText = getLatestUserMessageText(uiMessages);
      const run = await createResearchRun({
        userId,
        userPrompt: latestUserMessageText || "请继续当前研究请求",
        sessionId: hasPersistentSession ? sessionId : null,
        routeProfile,
      });
      let queued: QueuedResearchJob;
      try {
        queued = await enqueueBackgroundResearch({
          runId: run.id,
          userId,
          userPrompt: run.userPrompt,
          sessionId: hasPersistentSession ? sessionId : null,
          routeProfile,
        });
        await markResearchRunQueued(run.id);
      } catch (error) {
        await failResearchRun({
          runId: run.id,
          errorCode: "QUEUE_ENQUEUE_FAILED",
          errorMessage: error instanceof Error ? error.message : "研究任务入队失败",
        });
        throw error;
      }

      const acknowledgement =
        "这个请求会走后台深度研究：我会先拆成并行研究子任务，再做综合对比。你可以继续当前对话，研究完成后结果会回到这里。";

      if (hasPersistentSession && sessionId) {
        const metadata = await buildResearchRunMetadata(run.id, userId);
        if (metadata) {
          await mergeOwnedConversationMetadata({
            conversationId: sessionId,
            userId,
            metadataPatch: {
              backgroundResearch: metadata,
            },
          });
        }

        const queuedMessages = [...uiMessages, buildAssistantTextMessage(acknowledgement)];
        await persistConversationMessages(sessionId, userId, queuedMessages);
        if (await getConversationActiveStreamId(sessionId, userId)) {
          await setConversationActiveStreamId(sessionId, userId, null);
        }
      }

      const response = createStaticAssistantMessageResponse({
        text: acknowledgement,
      });
      response.headers.set("X-Request-Id", requestId);
      response.headers.set(AI_EXECUTION_MODE_HEADER, "workflow");
      response.headers.set(AI_HANDOFF_TARGET_HEADER, routeDecision.handoffTarget ?? "");
      response.headers.set(AI_WORKFLOW_JOB_ID_HEADER, run.id);
      response.headers.set(AI_WORKFLOW_JOB_TYPE_HEADER, queued.type);
      return response;
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
        routeProfile,
        telemetry,
      },
    });

    if (hasPersistentSession && sessionId) {
      await persistConversationMessages(sessionId, userId, uiMessages);
      if (await getConversationActiveStreamId(sessionId, userId)) {
        await setConversationActiveStreamId(sessionId, userId, null);
      }
    }

    const resumableStreamContext = getChatResumableStreamContext(after);

    const response = await createNexusNoteStreamResponse(agent, uiMessages, {
      sessionId,
      presentation: "chat",
      onFinish: async ({ messages }) => {
        if (!hasPersistentSession || !sessionId) {
          return;
        }

        await persistConversationMessages(sessionId, userId, messages);
        await setConversationActiveStreamId(sessionId, userId, null);
        after(async () => {
          await syncConversationKnowledge({
            conversationId: sessionId,
            userId,
            messages,
          });
        });
      },
      consumeSseStream: async ({ stream }) => {
        if (!hasPersistentSession || !sessionId) {
          return;
        }

        const streamId = crypto.randomUUID();
        await resumableStreamContext.createNewResumableStream(streamId, () => stream);
        await setConversationActiveStreamId(sessionId, userId, streamId);
      },
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

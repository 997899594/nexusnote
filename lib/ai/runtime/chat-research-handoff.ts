import type { UIMessage } from "ai";
import type { AIModelSeries } from "@/lib/ai/core/model-series";
import { createStaticAssistantMessageResponse } from "@/lib/ai/core/streaming";
import { extractUIMessageText } from "@/lib/ai/message-text";
import {
  buildResearchRunMetadata,
  createResearchRun,
  failResearchRun,
  markResearchRunQueued,
} from "@/lib/ai/research/store";
import { clearActiveChatStream, isPersistentChatSession } from "@/lib/ai/runtime/chat-session";
import type { RouteDecision } from "@/lib/ai/runtime/contracts";
import {
  AI_EXECUTION_MODE_HEADER,
  AI_HANDOFF_TARGET_HEADER,
  AI_WORKFLOW_JOB_ID_HEADER,
  AI_WORKFLOW_JOB_TYPE_HEADER,
} from "@/lib/ai/runtime/response-headers";
import { persistConversationMessages } from "@/lib/chat/conversation-persistence";
import { mergeOwnedConversationMetadata } from "@/lib/chat/conversation-repository";
import { enqueueBackgroundResearch, type QueuedResearchJob } from "@/lib/queue/research-queue";

const BACKGROUND_RESEARCH_ACKNOWLEDGEMENT =
  "这个请求会走后台深度研究：我会先拆成并行研究子任务，再做综合对比。你可以继续当前对话，研究完成后结果会回到这里。";

function getLatestUserMessageText(messages: UIMessage[]): string {
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

export function shouldStartBackgroundResearchWorkflow(params: {
  executionMode: string;
  handoffTarget: string | null;
}): boolean {
  return params.executionMode === "workflow" && params.handoffTarget === "research_assistant";
}

export async function createBackgroundResearchHandoffResponse(params: {
  userId: string;
  sessionId?: string | null;
  messages: UIMessage[];
  modelSeries: AIModelSeries;
  routeDecision: RouteDecision;
  requestId: string;
}): Promise<Response> {
  const run = await createResearchRun({
    userId: params.userId,
    userPrompt: getLatestUserMessageText(params.messages) || "请继续当前研究请求",
    sessionId: isPersistentChatSession(params.sessionId) ? params.sessionId : null,
    modelSeries: params.modelSeries,
  });

  let queued: QueuedResearchJob;
  try {
    queued = await enqueueBackgroundResearch({
      runId: run.id,
      userId: params.userId,
      userPrompt: run.userPrompt,
      sessionId: isPersistentChatSession(params.sessionId) ? params.sessionId : null,
      modelSeries: params.modelSeries,
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

  if (isPersistentChatSession(params.sessionId)) {
    const metadata = await buildResearchRunMetadata(run.id, params.userId);
    if (metadata) {
      await mergeOwnedConversationMetadata({
        conversationId: params.sessionId,
        userId: params.userId,
        metadataPatch: {
          backgroundResearch: metadata,
        },
      });
    }

    await persistConversationMessages(params.sessionId, params.userId, [
      ...params.messages,
      buildAssistantTextMessage(BACKGROUND_RESEARCH_ACKNOWLEDGEMENT),
    ]);
    await clearActiveChatStream({
      sessionId: params.sessionId,
      userId: params.userId,
    });
  }

  const response = createStaticAssistantMessageResponse({
    text: BACKGROUND_RESEARCH_ACKNOWLEDGEMENT,
  });
  response.headers.set("X-Request-Id", params.requestId);
  response.headers.set(AI_EXECUTION_MODE_HEADER, "workflow");
  response.headers.set(AI_HANDOFF_TARGET_HEADER, params.routeDecision.handoffTarget ?? "");
  response.headers.set(AI_WORKFLOW_JOB_ID_HEADER, run.id);
  response.headers.set(AI_WORKFLOW_JOB_TYPE_HEADER, queued.type);
  return response;
}

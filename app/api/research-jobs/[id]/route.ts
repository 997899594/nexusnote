import { z } from "zod";
import {
  buildResearchRunMetadata,
  createResearchRun,
  failResearchRun,
  getResearchRunById,
  getResearchRunSnapshot,
  markResearchRunQueued,
  requestResearchRunCancellation,
} from "@/lib/ai/research/store";
import { withDynamicAuth } from "@/lib/api";
import { mergeOwnedConversationMetadata } from "@/lib/chat/conversation-repository";
import { enqueueBackgroundResearch, getResearchQueue } from "@/lib/queue/research-queue";

const updateResearchRunSchema = z.object({
  action: z.enum(["cancel", "retry"]),
});

async function syncSessionMetadataForRun(runId: string, userId: string) {
  const run = await getResearchRunById(runId);
  if (!run?.sessionId) {
    return;
  }

  const metadata = await buildResearchRunMetadata(runId, userId);
  await mergeOwnedConversationMetadata({
    conversationId: run.sessionId,
    userId,
    metadataPatch: {
      backgroundResearch: metadata,
    },
  });
}

async function clearSessionMetadataForRun(runId: string, userId: string) {
  const run = await getResearchRunById(runId);
  if (!run?.sessionId) {
    return;
  }

  await mergeOwnedConversationMetadata({
    conversationId: run.sessionId,
    userId,
    metadataPatch: {
      backgroundResearch: null,
    },
  });
}

export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const snapshot = await getResearchRunSnapshot(params.id, userId);
    if (!snapshot) {
      return Response.json({ error: "Research job not found" }, { status: 404 });
    }

    return Response.json(snapshot);
  },
);

export const PATCH = withDynamicAuth<unknown, { id: string }>(
  async (request, { userId, params }) => {
    const body = updateResearchRunSchema.parse(await request.json());
    const snapshot = await getResearchRunSnapshot(params.id, userId);

    if (!snapshot) {
      return Response.json({ error: "Research job not found" }, { status: 404 });
    }

    if (body.action === "cancel") {
      if (!snapshot.canCancel) {
        return Response.json({ error: "research_run_cannot_cancel" }, { status: 409 });
      }

      const job = await getResearchQueue().getJob(params.id);
      const state = job ? await job.getState() : null;

      if (job && (state === "waiting" || state === "delayed" || state === "prioritized")) {
        await job.remove();
        await failResearchRun({
          runId: params.id,
          errorCode: "RUN_CANCELED",
          errorMessage: "研究任务已取消。",
          status: "canceled",
        });
        await syncSessionMetadataForRun(params.id, userId);
      } else {
        await requestResearchRunCancellation(params.id);
        await syncSessionMetadataForRun(params.id, userId);
      }

      const nextSnapshot = await getResearchRunSnapshot(params.id, userId);
      return Response.json(nextSnapshot, { status: 202 });
    }

    if (!snapshot.canRetry) {
      return Response.json({ error: "research_run_cannot_retry" }, { status: 409 });
    }

    const sourceRun = await getResearchRunById(params.id);
    if (!sourceRun || sourceRun.userId !== userId) {
      return Response.json({ error: "Research job not found" }, { status: 404 });
    }

    const nextRun = await createResearchRun({
      userId,
      sessionId: sourceRun.sessionId,
      userPrompt: sourceRun.userPrompt,
      routeProfile: sourceRun.routeProfile,
      retryOfRunId: sourceRun.id,
    });

    try {
      await enqueueBackgroundResearch({
        runId: nextRun.id,
        userId,
        userPrompt: nextRun.userPrompt,
        sessionId: nextRun.sessionId,
        routeProfile: nextRun.routeProfile,
      });
      await markResearchRunQueued(nextRun.id);
    } catch (error) {
      await failResearchRun({
        runId: nextRun.id,
        errorCode: "QUEUE_ENQUEUE_FAILED",
        errorMessage: error instanceof Error ? error.message : "研究任务重试入队失败",
      });
      throw error;
    }

    if (nextRun.sessionId) {
      const metadata = await buildResearchRunMetadata(nextRun.id, userId);
      await mergeOwnedConversationMetadata({
        conversationId: nextRun.sessionId,
        userId,
        metadataPatch: {
          backgroundResearch: metadata,
        },
      });
    } else {
      await clearSessionMetadataForRun(params.id, userId);
    }

    const nextSnapshot = await getResearchRunSnapshot(nextRun.id, userId);
    return Response.json(nextSnapshot, { status: 202 });
  },
);

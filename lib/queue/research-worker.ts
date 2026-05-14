import { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { normalizeAIRouteProfile } from "@/lib/ai/core/route-profiles";
import { buildResearchRunMetadata, failResearchRun } from "@/lib/ai/research/store";
import {
  ResearchRunCancelledError,
  runBackgroundResearchWorkflow,
} from "@/lib/ai/research/workflow";
import { mergeOwnedConversationMetadata } from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";
import { getRedis } from "@/lib/redis";
import type { ResearchJobData } from "./research-queue";

let worker: Worker<ResearchJobData> | null = null;

async function persistBackgroundResearchMetadata(params: {
  sessionId?: string | null;
  userId: string;
  runId: string | null;
}) {
  if (!params.sessionId || !isUuidString(params.sessionId)) {
    return;
  }

  const metadata =
    params.runId != null ? await buildResearchRunMetadata(params.runId, params.userId) : null;

  await mergeOwnedConversationMetadata({
    conversationId: params.sessionId,
    userId: params.userId,
    metadataPatch: {
      backgroundResearch: metadata,
    },
  });
}

export function startResearchWorker(): Worker<ResearchJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<ResearchJobData>(
    "research",
    async (job) => {
      if (job.data.type !== "run_background_research") {
        throw new Error(`Unknown research job type: ${job.data.type}`);
      }

      await persistBackgroundResearchMetadata({
        sessionId: job.data.sessionId ?? null,
        userId: job.data.userId,
        runId: job.data.runId,
      });

      try {
        const result = await runBackgroundResearchWorkflow({
          runId: job.data.runId,
          userId: job.data.userId,
          userPrompt: job.data.userPrompt,
          sessionId: job.data.sessionId ?? null,
          routeProfile:
            job.data.routeProfile != null
              ? normalizeAIRouteProfile(job.data.routeProfile)
              : undefined,
        });

        await job.updateProgress({
          stage: "completed",
          message: "研究结果已整理完成",
        });

        await persistBackgroundResearchMetadata({
          sessionId: job.data.sessionId ?? null,
          userId: job.data.userId,
          runId: null,
        });

        return result;
      } catch (error) {
        await failResearchRun({
          runId: job.data.runId,
          errorCode: error instanceof ResearchRunCancelledError ? "RUN_CANCELED" : "JOB_FAILED",
          errorMessage: error instanceof Error ? error.message : "研究任务执行失败",
          status: error instanceof ResearchRunCancelledError ? "canceled" : "failed",
        });

        await persistBackgroundResearchMetadata({
          sessionId: job.data.sessionId ?? null,
          userId: job.data.userId,
          runId: job.data.runId,
        });
        throw error;
      }
    },
    {
      connection: getRedis() as never,
      concurrency: defaults.queue.researchConcurrency,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[ResearchWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ResearchWorker] Failed: ${job?.id}`, err.message);
  });

  console.log("[ResearchWorker] Started with concurrency:", defaults.queue.researchConcurrency);
  return worker;
}

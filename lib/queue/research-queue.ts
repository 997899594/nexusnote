import type { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { createNexusQueue } from "@/lib/queue/bullmq";
import { buildSafeJobId } from "@/lib/queue/job-id";

export type ResearchJobData = {
  type: "run_background_research";
  runId: string;
  userId: string;
  userPrompt: string;
  sessionId?: string | null;
  modelSeries?: string | null;
};

export interface QueuedResearchJob {
  id: string | null;
  name: string;
  type: ResearchJobData["type"];
}

let researchQueue: Queue<ResearchJobData> | null = null;

export function getResearchQueue(): Queue<ResearchJobData> {
  if (researchQueue) {
    return researchQueue;
  }

  researchQueue = createNexusQueue<ResearchJobData>("research", {
    attempts: defaults.queue.researchMaxRetries,
    backoffDelay: defaults.queue.researchBackoffDelay,
    removeOnComplete: 500,
    removeOnFail: 2000,
  });

  return researchQueue;
}

export async function enqueueBackgroundResearch(params: {
  runId: string;
  userId: string;
  userPrompt: string;
  sessionId?: string | null;
  modelSeries?: string | null;
}): Promise<QueuedResearchJob> {
  const queued = await getResearchQueue().add(
    "run-background-research",
    {
      type: "run_background_research",
      runId: params.runId,
      userId: params.userId,
      userPrompt: params.userPrompt,
      sessionId: params.sessionId ?? null,
      modelSeries: params.modelSeries ?? null,
    },
    {
      jobId: buildSafeJobId(["research", params.runId]),
    },
  );

  return {
    id: queued.id != null ? String(queued.id) : null,
    name: queued.name,
    type: "run_background_research",
  };
}

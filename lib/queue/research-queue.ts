import { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { getRedis } from "@/lib/redis";

export type ResearchJobData = {
  type: "run_background_research";
  runId: string;
  userId: string;
  userPrompt: string;
  sessionId?: string | null;
  routeProfile?: string | null;
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

  researchQueue = new Queue<ResearchJobData>("research", {
    connection: getRedis() as never,
    defaultJobOptions: {
      attempts: defaults.queue.researchMaxRetries,
      backoff: {
        type: "exponential",
        delay: defaults.queue.researchBackoffDelay,
      },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  });

  return researchQueue;
}

export async function enqueueBackgroundResearch(params: {
  runId: string;
  userId: string;
  userPrompt: string;
  sessionId?: string | null;
  routeProfile?: string | null;
}): Promise<QueuedResearchJob> {
  const queued = await getResearchQueue().add(
    "run-background-research",
    {
      type: "run_background_research",
      runId: params.runId,
      userId: params.userId,
      userPrompt: params.userPrompt,
      sessionId: params.sessionId ?? null,
      routeProfile: params.routeProfile ?? null,
    },
    {
      jobId: params.runId,
    },
  );

  return {
    id: queued.id != null ? String(queued.id) : null,
    name: queued.name,
    type: "run_background_research",
  };
}

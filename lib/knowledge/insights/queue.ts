import type { KnowledgeInsightsQueueJobData } from "@/lib/queue/knowledge-insights-queue";
import { getKnowledgeInsightsQueue } from "@/lib/queue/knowledge-insights-queue";

export interface QueuedKnowledgeInsightsJob {
  id: string | undefined;
  type: KnowledgeInsightsQueueJobData["type"];
}

export async function enqueueKnowledgeInsights(
  userId: string,
): Promise<QueuedKnowledgeInsightsJob> {
  const job: KnowledgeInsightsQueueJobData = {
    type: "derive_user_insights",
    userId,
  };
  const queued = await getKnowledgeInsightsQueue().add(job.type, job);

  return {
    id: queued.id,
    type: job.type,
  };
}

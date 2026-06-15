import {
  assertWorkerRuntimeDefinition,
  type QueueWorkerId,
  queueWorkerRuntimeDefinition,
} from "./registry";
import type { WorkerRuntimeDefinition, WorkerStarter } from "./types";

type WorkerModuleResolver = () => Promise<Pick<WorkerStarter, "start">>;

const queueWorkerResolvers = {
  "course-production": async () => ({
    start: (await import("@/lib/queue/course-production-worker")).startCourseProductionWorker,
  }),
  "career-tree": async () => ({
    start: (await import("@/lib/queue/career-tree-worker")).startCareerTreeWorker,
  }),
  "knowledge-insights": async () => ({
    start: (await import("@/lib/queue/knowledge-insights-worker")).startKnowledgeInsightsWorker,
  }),
  "rag-index": async () => ({
    start: (await import("@/lib/queue/rag-worker")).startRagWorker,
  }),
  research: async () => ({
    start: (await import("@/lib/queue/research-worker")).startResearchWorker,
  }),
} satisfies Record<QueueWorkerId, WorkerModuleResolver>;

function getQueueWorkerResolver(workerId: QueueWorkerId): WorkerModuleResolver {
  const resolver = queueWorkerResolvers[workerId];

  if (!resolver) {
    throw new Error(`Queue worker runtime is missing resolver for ${workerId}.`);
  }

  return resolver;
}

export function getQueueWorkerRuntimeContract(
  definition: WorkerRuntimeDefinition<QueueWorkerId> = queueWorkerRuntimeDefinition,
): WorkerRuntimeDefinition<QueueWorkerId> {
  const runtimeDefinition = assertWorkerRuntimeDefinition(
    definition,
  ) as WorkerRuntimeDefinition<QueueWorkerId>;

  for (const worker of runtimeDefinition.workers) {
    getQueueWorkerResolver(worker.id);
  }

  return runtimeDefinition;
}

export async function createQueueWorkerStarters(
  definition: WorkerRuntimeDefinition<QueueWorkerId> = queueWorkerRuntimeDefinition,
): Promise<WorkerStarter[]> {
  const runtimeDefinition = getQueueWorkerRuntimeContract(definition);

  return Promise.all(
    runtimeDefinition.workers.map(async (worker) => {
      const resolver = getQueueWorkerResolver(worker.id);
      const module = await resolver();

      return {
        name: worker.name,
        start: module.start,
      };
    }),
  );
}

export async function startQueueWorkersRuntime(): Promise<void> {
  const definition = getQueueWorkerRuntimeContract();
  const [{ startWorkerRuntime }, workerStarters] = await Promise.all([
    import("./runtime"),
    createQueueWorkerStarters(definition),
  ]);

  startWorkerRuntime(definition.runtimeName, workerStarters);
}

import type { WorkerRuntimeDefinition } from "./types";

export type QueueWorkerId =
  | "learning-outbox"
  | "analytics-outbox"
  | "course-production"
  | "career-tree"
  | "note-followups"
  | "knowledge-insights"
  | "rag-index"
  | "research";

export const queueWorkerRuntimeDefinition = {
  runtimeName: "QueueWorkersRuntime",
  workers: [
    {
      id: "learning-outbox",
      name: "learning-outbox",
    },
    {
      id: "analytics-outbox",
      name: "analytics-outbox",
    },
    {
      id: "course-production",
      name: "course-production",
    },
    {
      id: "career-tree",
      name: "career-tree",
    },
    {
      id: "note-followups",
      name: "note-followups",
    },
    {
      id: "knowledge-insights",
      name: "knowledge-insights",
    },
    {
      id: "rag-index",
      name: "rag-index",
    },
    {
      id: "research",
      name: "research",
    },
  ],
} satisfies WorkerRuntimeDefinition<QueueWorkerId>;

export function assertWorkerRuntimeDefinition(
  definition: WorkerRuntimeDefinition,
): WorkerRuntimeDefinition {
  if (!definition.runtimeName.trim()) {
    throw new Error("Worker runtime definition must include a runtime name.");
  }

  if (definition.workers.length === 0) {
    throw new Error(`Worker runtime ${definition.runtimeName} must define at least one worker.`);
  }

  const workerIds = new Set<string>();
  const workerNames = new Set<string>();

  for (const worker of definition.workers) {
    if (!worker.id.trim()) {
      throw new Error(`Worker runtime ${definition.runtimeName} contains an empty worker id.`);
    }

    if (!worker.name.trim()) {
      throw new Error(`Worker runtime ${definition.runtimeName} contains an empty worker name.`);
    }

    if (workerIds.has(worker.id)) {
      throw new Error(
        `Worker runtime ${definition.runtimeName} contains duplicate id ${worker.id}.`,
      );
    }

    if (workerNames.has(worker.name)) {
      throw new Error(
        `Worker runtime ${definition.runtimeName} contains duplicate worker ${worker.name}.`,
      );
    }

    workerIds.add(worker.id);
    workerNames.add(worker.name);
  }

  return definition;
}

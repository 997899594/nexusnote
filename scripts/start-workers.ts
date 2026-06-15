type WorkerHandle = {
  pause?: (doNotWaitActive?: boolean) => Promise<void>;
  close: (force?: boolean) => Promise<void>;
};

type WorkerStarter = {
  name: string;
  start: () => WorkerHandle;
};

export {};

if (process.env.WORKER_RUNTIME_SMOKE === "1") {
  console.log("[QueueWorkersRuntime] Smoke entrypoint passed");
  process.exit(0);
}

const [
  { startWorkerRuntime },
  { startCourseProductionWorker },
  { startCareerTreeWorker },
  { startKnowledgeInsightsWorker },
  { startRagWorker },
  { startResearchWorker },
] = await Promise.all([
  import("./worker-runtime"),
  import("@/lib/queue/course-production-worker"),
  import("@/lib/queue/career-tree-worker"),
  import("@/lib/queue/knowledge-insights-worker"),
  import("@/lib/queue/rag-worker"),
  import("@/lib/queue/research-worker"),
]);

startWorkerRuntime("QueueWorkersRuntime", [
  {
    name: "course-production",
    start: startCourseProductionWorker,
  },
  {
    name: "career-tree",
    start: startCareerTreeWorker,
  },
  {
    name: "knowledge-insights",
    start: startKnowledgeInsightsWorker,
  },
  {
    name: "rag-index",
    start: startRagWorker,
  },
  {
    name: "research",
    start: startResearchWorker,
  },
] satisfies WorkerStarter[]);

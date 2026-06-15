import { startCareerTreeWorker } from "@/lib/queue/career-tree-worker";
import { startCourseProductionWorker } from "@/lib/queue/course-production-worker";
import { startKnowledgeInsightsWorker } from "@/lib/queue/knowledge-insights-worker";
import { startRagWorker } from "@/lib/queue/rag-worker";
import { startResearchWorker } from "@/lib/queue/research-worker";
import { startWorkerRuntime } from "./worker-runtime";

if (process.env.WORKER_RUNTIME_SMOKE === "1") {
  console.log("[QueueWorkersRuntime] Smoke import passed");
  process.exit(0);
}

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
]);

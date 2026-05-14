import { startCareerTreeWorker } from "@/lib/queue/career-tree-worker";
import { startCourseProductionWorker } from "@/lib/queue/course-production-worker";
import { startKnowledgeInsightsWorker } from "@/lib/queue/knowledge-insights-worker";
import { startRagWorker } from "@/lib/queue/rag-worker";
import { startResearchWorker } from "@/lib/queue/research-worker";
import { startWorkerRuntime } from "./worker-runtime";

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

import { startKnowledgeInsightsWorker } from "@/lib/queue/knowledge-insights-worker";
import { startWorkerRuntime } from "@/lib/worker-runtime/runtime";

startWorkerRuntime("KnowledgeInsightsRuntime", [
  {
    name: "knowledge-insights",
    start: startKnowledgeInsightsWorker,
  },
]);

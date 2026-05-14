import { startKnowledgeInsightsWorker } from "@/lib/queue/knowledge-insights-worker";
import { startWorkerRuntime } from "./worker-runtime";

startWorkerRuntime("KnowledgeInsightsRuntime", [
  {
    name: "knowledge-insights",
    start: startKnowledgeInsightsWorker,
  },
]);

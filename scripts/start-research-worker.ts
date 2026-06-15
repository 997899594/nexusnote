import { startResearchWorker } from "@/lib/queue/research-worker";
import { startWorkerRuntime } from "@/lib/worker-runtime/runtime";

startWorkerRuntime("ResearchRuntime", [
  {
    name: "research",
    start: startResearchWorker,
  },
]);

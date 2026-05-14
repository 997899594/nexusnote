import { startResearchWorker } from "@/lib/queue/research-worker";
import { startWorkerRuntime } from "./worker-runtime";

startWorkerRuntime("ResearchRuntime", [
  {
    name: "research",
    start: startResearchWorker,
  },
]);

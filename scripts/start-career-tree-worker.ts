import { startCareerTreeWorker } from "@/lib/queue/career-tree-worker";
import { startWorkerRuntime } from "@/lib/worker-runtime/runtime";

startWorkerRuntime("CareerTreeRuntime", [
  {
    name: "career-tree",
    start: startCareerTreeWorker,
  },
]);

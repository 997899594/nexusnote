import { startCareerTreeWorker } from "@/lib/queue/career-tree-worker";
import { startWorkerRuntime } from "./worker-runtime";

startWorkerRuntime("CareerTreeRuntime", [
  {
    name: "career-tree",
    start: startCareerTreeWorker,
  },
]);

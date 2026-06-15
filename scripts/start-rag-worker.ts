import { startRagWorker } from "@/lib/queue/rag-worker";
import { startWorkerRuntime } from "@/lib/worker-runtime/runtime";

startWorkerRuntime("RagRuntime", [
  {
    name: "rag-index",
    start: startRagWorker,
  },
]);

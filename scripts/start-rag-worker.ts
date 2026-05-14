import { startRagWorker } from "@/lib/queue/rag-worker";
import { startWorkerRuntime } from "./worker-runtime";

startWorkerRuntime("RagRuntime", [
  {
    name: "rag-index",
    start: startRagWorker,
  },
]);

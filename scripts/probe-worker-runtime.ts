import { getQueueWorkerRuntimeContract } from "@/lib/worker-runtime/queue-runtime";

const definition = getQueueWorkerRuntimeContract();

console.log(
  `[${definition.runtimeName}] Runtime contract passed: ${definition.workers
    .map((worker) => worker.name)
    .join(", ")}`,
);

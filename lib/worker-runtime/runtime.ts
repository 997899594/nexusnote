import { closeDbConnection } from "@/db";
import { closeRedisConnection } from "@/lib/redis";
import { startRuntimeHeartbeat } from "./heartbeat";
import type { WorkerStarter } from "./types";

const WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

function formatWorkerNames(workers: WorkerStarter[]): string {
  return workers.map((worker) => worker.name).join(", ");
}

async function closeWorkerWithTimeout(params: {
  runtimeName: string;
  workerName: string;
  worker: ReturnType<WorkerStarter["start"]>;
}) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  await params.worker.pause?.(true);

  const timedOut = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => {
      resolve("timeout");
    }, WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  });

  const result = await Promise.race([
    params.worker.close().then(() => "closed" as const),
    timedOut,
  ]);

  if (timeout) {
    clearTimeout(timeout);
  }

  if (result === "timeout") {
    console.warn(
      `[${params.runtimeName}] Worker ${params.workerName} close timed out after ${WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS}ms; exiting without waiting for active jobs.`,
    );
  }
}

async function closeWorkersWithTimeout(
  runtimeName: string,
  workers: Array<{ name: string; worker: ReturnType<WorkerStarter["start"]> }>,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timedOut = new Promise<"timeout">((resolve) => {
    timeout = setTimeout(() => resolve("timeout"), WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS + 1_000);
  });
  const closed = Promise.allSettled(
    workers.map((worker) =>
      closeWorkerWithTimeout({
        runtimeName,
        workerName: worker.name,
        worker: worker.worker,
      }),
    ),
  ).then((results) => ({ status: "closed" as const, results }));

  const result = await Promise.race([closed, timedOut]);

  if (timeout) {
    clearTimeout(timeout);
  }

  return {
    results: result === "timeout" ? ([] as PromiseSettledResult<void>[]) : result.results,
    timedOut: result === "timeout",
  };
}

function closeRuntimeResources() {
  const closeResources = Promise.allSettled([closeDbConnection(), closeRedisConnection()]);
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<PromiseSettledResult<void>[]>((resolve) => {
    timeout = setTimeout(() => resolve([]), 5_000);
  });

  return Promise.race([closeResources, timedOut]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export function startWorkerRuntime(runtimeName: string, workerStarters: WorkerStarter[]): void {
  const workers = workerStarters.map((workerStarter) => ({
    name: workerStarter.name,
    worker: workerStarter.start(),
  }));
  const stopHeartbeat = startRuntimeHeartbeat(runtimeName);
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    stopHeartbeat();
    console.log(`[${runtimeName}] Shutting down on ${signal}...`);
    const workerClosure = await closeWorkersWithTimeout(runtimeName, workers);
    const workerResults = workerClosure.results;
    if (workerClosure.timedOut) {
      console.warn(`[${runtimeName}] Worker shutdown window elapsed; continuing runtime cleanup.`);
    }
    const failedClosures = workerResults.filter((result) => result.status === "rejected");

    if (failedClosures.length > 0) {
      failedClosures.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`[${runtimeName}] Worker close failed #${index + 1}:`, result.reason);
        }
      });
    }

    const runtimeResourceResults = await closeRuntimeResources();
    const failedResourceClosures = runtimeResourceResults.filter(
      (result) => result.status === "rejected",
    );

    if (failedResourceClosures.length > 0) {
      failedResourceClosures.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `[${runtimeName}] Runtime resource close failed #${index + 1}:`,
            result.reason,
          );
        }
      });
    }

    process.exit(failedClosures.length > 0 || failedResourceClosures.length > 0 ? 1 : 0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  console.log(`[${runtimeName}] Ready: ${formatWorkerNames(workerStarters)}`);
}

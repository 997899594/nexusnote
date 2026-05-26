import { closeDbConnection } from "@/db";
import { closeRedisConnection } from "@/lib/redis";

type WorkerStarter = {
  name: string;
  start: () => {
    close: () => Promise<void>;
  };
};

function formatWorkerNames(workers: WorkerStarter[]): string {
  return workers.map((worker) => worker.name).join(", ");
}

export function startWorkerRuntime(runtimeName: string, workerStarters: WorkerStarter[]): void {
  const workers = workerStarters.map((workerStarter) => workerStarter.start());
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`[${runtimeName}] Shutting down on ${signal}...`);
    const workerResults = await Promise.allSettled(workers.map((worker) => worker.close()));
    const failedClosures = workerResults.filter((result) => result.status === "rejected");

    if (failedClosures.length > 0) {
      failedClosures.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`[${runtimeName}] Worker close failed #${index + 1}:`, result.reason);
        }
      });
    }

    const runtimeResourceResults = await Promise.allSettled([
      closeDbConnection(),
      closeRedisConnection(),
    ]);
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

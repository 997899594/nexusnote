import { closeDbConnection } from "@/db";

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

    try {
      await closeDbConnection();
    } finally {
      process.exit(failedClosures.length > 0 ? 1 : 0);
    }
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  console.log(`[${runtimeName}] Ready: ${formatWorkerNames(workerStarters)}`);
}

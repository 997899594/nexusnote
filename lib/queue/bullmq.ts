import { type Job, Queue, Worker } from "bullmq";
import { buildErrorLogFields, writeStructuredLog } from "@/lib/observability/structured-log";
import { getRedis } from "@/lib/redis";

interface QueueRetryOptions {
  attempts: number;
  backoffDelay: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

export function createNexusQueue<T>(name: string, options: QueueRetryOptions): Queue<T> {
  return new Queue<T>(name, {
    connection: getRedis() as never,
    defaultJobOptions: {
      attempts: options.attempts,
      backoff: {
        type: "exponential",
        delay: options.backoffDelay,
      },
      removeOnComplete: { count: options.removeOnComplete ?? 1000 },
      removeOnFail: { count: options.removeOnFail ?? 5000 },
    },
  });
}

interface WorkerOptions {
  concurrency: number;
  label: string;
  logProgressOnComplete?: boolean;
}

export function createNexusWorker<T, R = unknown>(
  name: string,
  processor: (job: Job<T>) => Promise<R>,
  options: WorkerOptions,
): Worker<T, R> {
  const worker = new Worker<T, R>(name, processor, {
    connection: getRedis() as never,
    concurrency: options.concurrency,
  });

  worker.on("completed", (job) => {
    if (options.logProgressOnComplete) {
      console.log(`[${options.label}] Completed: ${job.id}`, job.progress);
      return;
    }

    console.log(`[${options.label}] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${options.label}] Failed: ${job?.id}`, err.message);
    writeStructuredLog("error", "queue_job_failed", {
      queue: name,
      label: options.label,
      jobId: job?.id ?? null,
      jobName: job?.name ?? null,
      attemptsMade: job?.attemptsMade ?? null,
      maxAttempts: job?.opts.attempts ?? null,
      data: job?.data ?? null,
      ...buildErrorLogFields(err),
    });
  });

  console.log(`[${options.label}] Started with concurrency:`, options.concurrency);

  return worker;
}

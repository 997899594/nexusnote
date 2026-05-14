/**
 * RAG Index Worker - BullMQ
 *
 * Processes indexing jobs inside an explicit worker runtime.
 */

import { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { syncCourseSectionKnowledgeByDocumentId } from "@/lib/learning/course-section-knowledge";
import { getRedis } from "@/lib/redis";
import type { RagIndexJobData } from "./rag-queue";

let worker: Worker<RagIndexJobData> | null = null;

export function startRagWorker(): Worker<RagIndexJobData> {
  if (worker) return worker;

  worker = new Worker<RagIndexJobData>(
    "rag-index",
    async (job) => {
      const { type, documentId, userId, courseId, contentHash } = job.data;

      console.log(
        `[RagWorker] Processing ${type}: ${documentId} (${contentHash.slice(0, 12)}, attempt ${
          job.attemptsMade + 1
        })`,
      );

      switch (type) {
        case "course_section": {
          const result = await syncCourseSectionKnowledgeByDocumentId({
            documentId,
            userId,
            courseId,
          });
          await job.updateProgress({
            indexedContentHash: result.indexedContentHash,
            requestedContentHash: contentHash,
            chunks: result.chunks,
          });
          break;
        }
        default:
          console.warn(`[RagWorker] Unknown job type: ${type}`);
      }
    },
    {
      connection: getRedis() as never,
      concurrency: defaults.queue.ragConcurrency,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[RagWorker] Completed: ${job.id}`, job.progress);
  });

  worker.on("failed", (job, err) => {
    console.error(`[RagWorker] Failed: ${job?.id}`, err.message);
  });

  console.log("[RagWorker] Started with concurrency:", defaults.queue.ragConcurrency);
  return worker;
}

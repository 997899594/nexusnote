/**
 * RAG Index Worker - BullMQ
 *
 * Processes indexing jobs inside an explicit worker runtime.
 */

import type { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { syncCourseSectionKnowledgeByDocumentId } from "@/lib/learning/course-section-knowledge";
import { createNexusWorker } from "./bullmq";
import type { RagIndexJobData } from "./rag-queue";

let worker: Worker<RagIndexJobData> | null = null;

export function startRagWorker(): Worker<RagIndexJobData> {
  if (worker) return worker;

  worker = createNexusWorker<RagIndexJobData>(
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
      label: "RagWorker",
      concurrency: defaults.queue.ragConcurrency,
      logProgressOnComplete: true,
    },
  );
  return worker;
}

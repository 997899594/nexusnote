/**
 * RAG Index Worker - BullMQ
 *
 * Processes indexing jobs with configurable concurrency.
 * Lazy-started via instrumentation.ts to avoid duplicate workers.
 */

import { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { syncCourseSectionKnowledge } from "@/lib/learning/course-section-knowledge";
import { redis } from "@/lib/redis";
import type { RagIndexJobData } from "./rag-queue";

let worker: Worker<RagIndexJobData> | null = null;

export function startRagWorker(): Worker<RagIndexJobData> {
  if (worker) return worker;

  worker = new Worker<RagIndexJobData>(
    "rag-index",
    async (job) => {
      const { type, documentId, plainText, userId, courseId, metadata } = job.data;

      console.log(
        `[RagWorker] Processing ${type}: ${documentId} (attempt ${job.attemptsMade + 1})`,
      );

      switch (type) {
        case "course_section":
          await syncCourseSectionKnowledge({
            documentId,
            plainText,
            userId,
            courseId,
            chapterIndex: metadata?.chapterIndex ?? 0,
            sectionIndex: metadata?.sectionIndex ?? 0,
            sectionTitle: metadata?.sectionTitle ?? "课程内容",
          });
          break;
        default:
          console.warn(`[RagWorker] Unknown job type: ${type}`);
      }
    },
    {
      connection: redis as never,
      concurrency: defaults.queue.ragConcurrency,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[RagWorker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[RagWorker] Failed: ${job?.id}`, err.message);
  });

  console.log("[RagWorker] Started with concurrency:", defaults.queue.ragConcurrency);
  return worker;
}

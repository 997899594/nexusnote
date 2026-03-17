/**
 * RAG Index Queue - BullMQ
 *
 * Replaces fire-and-forget indexing with reliable queue processing.
 * Uses exponential backoff retry (3 attempts).
 */

import { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { redis } from "@/lib/redis";

export interface RagIndexJobData {
  type: "course_section";
  documentId: string;
  plainText: string;
  userId: string;
  courseId: string;
  metadata?: {
    chapterIndex: number;
    sectionIndex: number;
    sectionTitle: string;
  };
}

export const ragQueue = new Queue<RagIndexJobData>("rag-index", {
  connection: redis as never,
  defaultJobOptions: {
    attempts: defaults.queue.ragMaxRetries,
    backoff: {
      type: "exponential",
      delay: defaults.queue.ragBackoffDelay,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/**
 * RAG Index Queue - BullMQ
 *
 * Replaces fire-and-forget indexing with reliable queue processing.
 * Uses exponential backoff retry (3 attempts).
 */

import type { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { buildKnowledgeContentHash } from "@/lib/knowledge/content-hash";
import { createNexusQueue } from "@/lib/queue/bullmq";

export interface RagIndexJobData {
  type: "course_section";
  documentId: string;
  userId: string;
  courseId: string;
  contentHash: string;
}

export interface QueuedRagIndexJob {
  id: string | null;
  name: string;
  type: RagIndexJobData["type"];
}

let ragQueue: Queue<RagIndexJobData> | null = null;

export function getRagQueue(): Queue<RagIndexJobData> {
  if (ragQueue) {
    return ragQueue;
  }

  ragQueue = createNexusQueue<RagIndexJobData>("rag-index", {
    attempts: defaults.queue.ragMaxRetries,
    backoffDelay: defaults.queue.ragBackoffDelay,
  });

  return ragQueue;
}

export function buildRagContentHash(content: string): string {
  return buildKnowledgeContentHash(content);
}

export async function enqueueCourseSectionRagIndex(params: {
  documentId: string;
  plainText: string;
  userId: string;
  courseId: string;
}): Promise<QueuedRagIndexJob | null> {
  const plainText = params.plainText.trim();
  if (!plainText) {
    return null;
  }

  const contentHash = buildRagContentHash(plainText);
  const queued = await getRagQueue().add(
    "course-section",
    {
      type: "course_section",
      documentId: params.documentId,
      userId: params.userId,
      courseId: params.courseId,
      contentHash,
    },
    {
      jobId: `course-section-${params.documentId}-${contentHash}`,
    },
  );

  return {
    id: queued.id ?? null,
    name: queued.name,
    type: "course_section",
  };
}

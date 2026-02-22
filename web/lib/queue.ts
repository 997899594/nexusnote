/**
 * Queue Module - BullMQ 后台任务队列
 *
 * 使用 BullMQ 处理聊天会话的语义分块和向量索引
 */

import { env } from "@/config/env";
import type { UIMessage } from "ai";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

// ============================================
// Queue Configuration
// ============================================

export const queueConfig = {
  redisHost: env.REDIS_HOST || "localhost",
  redisPort: parseInt(env.REDIS_PORT || "6379", 10),
};

// ============================================
// Conversation Indexing Queue
// ============================================

export interface ConversationIndexJobData {
  conversationId: string;
  userId: string;
  messages: UIMessage[];
}

let redis: IORedis | null = null;
let queue: Queue<ConversationIndexJobData> | null = null;
let worker: Worker<ConversationIndexJobData> | null = null;

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export function getConversationIndexQueue(): Queue<ConversationIndexJobData> {
  if (!queue) {
    queue = new Queue<ConversationIndexJobData>("conversation-index", {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

async function processJob(job: { data: ConversationIndexJobData }) {
  const { conversationId, userId, messages } = job.data;

  console.log(`[ConvIndex] Processing conversation: ${conversationId}`);

  try {
    const messagesArray = messages.map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(""),
    }));

    // Import services dynamically to avoid circular dependencies
    const { semanticChunkConversation } = await import("@/lib/rag");
    const { indexConversation } = await import("@/lib/rag");

    const chunks = await semanticChunkConversation(messagesArray);

    if (chunks.length === 0) {
      console.log(`[ConvIndex] No chunks to index for: ${conversationId}`);
      return { success: true, chunksCount: 0 };
    }

    const plainText = chunks.map((c) => c.content).join("\n\n");

    const result = await indexConversation(conversationId, plainText, userId);

    console.log(`[ConvIndex] ✅ Indexed ${result.chunksCount} chunks for: ${conversationId}`);

    return { success: true, chunksCount: result.chunksCount };
  } catch (error) {
    console.error(`[ConvIndex] ❌ Error indexing conversation:`, error);
    throw error;
  }
}

export function startConversationIndexWorker(): Worker<ConversationIndexJobData> {
  if (worker) return worker;

  worker = new Worker<ConversationIndexJobData>("conversation-index", processJob, {
    connection: getRedis(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[ConvIndex] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ConvIndex] Job ${job?.id} failed:`, err.message);
  });

  console.log("[ConvIndex] Worker started");
  return worker;
}

export async function enqueueConversationIndex(
  conversationId: string,
  userId: string,
  messages: UIMessage[],
): Promise<void> {
  const q = getConversationIndexQueue();
  await q.add("index", { conversationId, userId, messages });
  console.log(`[ConvIndex] Enqueued conversation: ${conversationId}`);
}

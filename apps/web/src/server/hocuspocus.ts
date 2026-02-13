/**
 * Hocuspocus WebSocket Server - 协作编辑
 *
 * 在 Next.js fullstack 中运行
 * 处理文档实时同步、用户光标、删除恢复等
 */

import { Database } from "@hocuspocus/extension-database";
import { Redis } from "@hocuspocus/extension-redis";
import { Server } from "@hocuspocus/server";
import { env } from "@nexusnote/config";
import { db, documents, eq } from "@nexusnote/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import * as Y from "yjs";

// Redis 客户端（分布式锁）
const redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// BullMQ 队列
const ragQueue = new Queue("rag-index", {
  connection: redis,
  defaultJobOptions: {
    attempts: env.QUEUE_RAG_MAX_RETRIES || 3,
    backoff: {
      type: "exponential",
      delay: env.QUEUE_RAG_BACKOFF_DELAY || 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * 分布式去重：确保即使多个实例也只触发一次 RAG 索引
 */
async function debouncedIndexDocument(documentId: string, plainText: string) {
  const lockKey = `lock:rag-index:${documentId}`;
  const acquired = await redis.set(lockKey, "locked", "EX", 10, "NX");

  if (!acquired) {
    // 已被其他实例锁定，跳过
    console.log(`[Hocuspocus] Skipped (already locked): ${documentId}`);
    return;
  }

  console.log(`[Hocuspocus] Lock acquired for RAG index: ${documentId}`);

  try {
    // 1. 更新数据库中的纯文本
    await db
      .update(documents)
      .set({ plainText, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    // 2. 将 RAG 索引任务添加到 BullMQ 队列
    await ragQueue.add("index", {
      documentId,
      plainText,
    });

    console.log(`[Hocuspocus] ✅ Queued RAG index job for: ${documentId}`);
  } catch (err) {
    console.error(`[Hocuspocus] ❌ Failed to index document:`, err);
  }
}

/**
 * 提取纯文本（从 Yjs 文档）
 */
function getPlainText(ydoc: Y.Doc): string {
  const ytext = ydoc.getText("content");
  return ytext.toString();
}

/**
 * 创建并返回 Hocuspocus 服务器实例
 */
export function createHocuspocusServer() {
  const server = Server.configure({
    // 监听所有网卡，端口由环境变量控制
    address: "0.0.0.0",
    port: env.HOCUSPOCUS_PORT,

    // 扩展：数据库持久化
    extensions: [
      new Database({
        // 从数据库加载文档（返回 Yjs 二进制状态）
        fetch: async ({ documentName }) => {
          console.log(`[Hocuspocus] Fetching from DB: ${documentName}`);
          try {
            const doc = await db.query.documents.findFirst({
              where: eq(documents.id, documentName),
            });

            if (!doc || !doc.content) {
              return null;
            }

            // doc.content 是 Buffer（存储时 Buffer.from(state)），直接返回即可
            // Buffer extends Uint8Array，与 Hocuspocus 期望的类型兼容
            return new Uint8Array(doc.content);
          } catch (err) {
            console.error(`[Hocuspocus] Failed to fetch document:`, err);
            return null;
          }
        },

        // 保存文档到数据库
        store: async ({ documentName, state }) => {
          console.log(`[Hocuspocus] Storing to DB: ${documentName}`);
          try {
            // 从 state 中解码出纯文本，用于搜索和 RAG
            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, state);
            const plainText = getPlainText(ydoc);

            await db
              .insert(documents)
              .values({
                id: documentName,
                content: Buffer.from(state),
                plainText,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: documents.id,
                set: {
                  content: Buffer.from(state),
                  updatedAt: new Date(),
                },
              });

            console.log(`[Hocuspocus] Stored document: ${documentName}`);
          } catch (err) {
            console.error(`[Hocuspocus] Failed to store document:`, err);
          }
        },
      }),

      // 扩展：Redis 分布式锁（仅用于去重，不用于持久化）
      new Redis({
        redis,
      }),
    ],

    // 认证回调
    onConnect: async ({ documentName }) => {
      console.log(`[Hocuspocus] Client connecting: ${documentName}`);
      // TODO: 迁移到 onAuthenticate 回调中验证 JWT token
      return true;
    },

    onDisconnect: async ({ documentName }) => {
      console.log(`[Hocuspocus] Client disconnected: ${documentName}`);
    },

    // 文档更新回调（触发 RAG 索引）
    onChange: async ({ documentName, document }) => {
      // document 是 Hocuspocus Document（extends Y.Doc），可直接提取文本
      const plainText = getPlainText(document);

      // 使用去重锁，避免多实例重复索引
      await debouncedIndexDocument(documentName, plainText);
    },

    // 感知变更（光标位置、用户列表等）
    onAwarenessUpdate: async ({ document }) => {
      const clients = document.awareness.getStates();
      console.log(`[Hocuspocus] Active clients in awareness: ${clients.size}`);
    },
  });

  return server;
}

/**
 * 启动服务器（如果作为独立进程运行）
 */
export async function startHocuspocusServer() {
  try {
    const server = createHocuspocusServer();
    await server.listen();
    console.log(`[Hocuspocus] ✅ Server listening on ws://0.0.0.0:${env.HOCUSPOCUS_PORT || 1234}`);
    return server;
  } catch (err) {
    console.error("[Hocuspocus] ❌ Failed to start server:", err);
    throw err;
  }
}

// 启动服务器
if (require.main === module || process.env.NODE_ENV === "production") {
  startHocuspocusServer().catch((err) => {
    console.error("[Hocuspocus] Fatal error during startup:", err);
    process.exit(1);
  });
}

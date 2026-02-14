/**
 * @nexusnote/collab — 协作编辑独立服务
 *
 * 基于 Hocuspocus（Yjs WebSocket 后端），负责：
 * - 文档实时同步（CRDT）
 * - 数据库持久化（Yjs 二进制状态）
 * - Redis 分布式锁（多实例去重）
 * - BullMQ 异步 RAG 索引
 *
 * 从 apps/web 中拆分为独立进程，可独立部署和水平扩展。
 */

import { Database } from "@hocuspocus/extension-database";
import { Redis } from "@hocuspocus/extension-redis";
import { Server } from "@hocuspocus/server";
import { env } from "@nexusnote/config";
import { db, documents, eq } from "@nexusnote/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import * as Y from "yjs";

// ============================================
// 基础设施连接
// ============================================

const redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

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

// ============================================
// 辅助函数
// ============================================

/**
 * 分布式去重：Redis NX 锁确保多实例只触发一次 RAG 索引
 */
async function debouncedIndexDocument(documentId: string, plainText: string): Promise<void> {
  const lockKey = `lock:rag-index:${documentId}`;
  const acquired = await redis.set(lockKey, "locked", "EX", 10, "NX");

  if (!acquired) {
    console.log(`[collab] 跳过（已被其他实例锁定）: ${documentId}`);
    return;
  }

  console.log(`[collab] 获取锁，开始 RAG 索引: ${documentId}`);

  try {
    // 更新数据库纯文本（用于全文搜索）
    await db
      .update(documents)
      .set({ plainText, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    // 异步 RAG 索引（BullMQ 队列）
    await ragQueue.add("index", { documentId, plainText });

    console.log(`[collab] RAG 索引任务已入队: ${documentId}`);
  } catch (err) {
    console.error(`[collab] RAG 索引失败:`, err);
  }
}

/** 从 Yjs Doc 提取纯文本 */
function getPlainText(ydoc: Y.Doc): string {
  return ydoc.getText("content").toString();
}

// ============================================
// 服务器配置
// ============================================

function createServer(): ReturnType<typeof Server.configure> {
  return Server.configure({
    address: "0.0.0.0",
    port: env.HOCUSPOCUS_PORT,

    extensions: [
      // 数据库持久化（Yjs 二进制状态 ↔ PostgreSQL）
      new Database({
        fetch: async ({ documentName }) => {
          console.log(`[collab] 加载文档: ${documentName}`);
          try {
            const doc = await db.query.documents.findFirst({
              where: eq(documents.id, documentName),
            });
            if (!doc?.content) return null;
            return new Uint8Array(doc.content);
          } catch (err) {
            console.error(`[collab] 加载文档失败:`, err);
            return null;
          }
        },

        store: async ({ documentName, state }) => {
          console.log(`[collab] 保存文档: ${documentName}`);
          try {
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
          } catch (err) {
            console.error(`[collab] 保存文档失败:`, err);
          }
        },
      }),

      // Redis 分布式同步（多实例 awareness 同步）
      new Redis({ redis }),
    ],

    // 连接回调
    onConnect: async ({ documentName }) => {
      console.log(`[collab] 客户端连接: ${documentName}`);
      // TODO: onAuthenticate 回调中验证 JWT token
      return true;
    },

    onDisconnect: async ({ documentName }) => {
      console.log(`[collab] 客户端断开: ${documentName}`);
    },

    // 文档变更 → 异步 RAG 索引
    onChange: async ({ documentName, document }) => {
      const plainText = getPlainText(document);
      await debouncedIndexDocument(documentName, plainText);
    },
  });
}

// ============================================
// 启动
// ============================================

async function main(): Promise<void> {
  const server = createServer();
  await server.listen();
  console.log(`[collab] 协作服务已启动 ws://0.0.0.0:${env.HOCUSPOCUS_PORT || 1234}`);
}

main().catch((err) => {
  console.error("[collab] 启动失败:", err);
  process.exit(1);
});

import { Injectable, OnModuleInit } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as postgres from "postgres";
import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { documents, documentChunks } from "@nexusnote/db";

// ============================================
// 2026 现代化配置 - AI SDK 6.x
// ============================================
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/nexusnote";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380";

// 302.ai Embedding 配置 - Qwen3-Embedding-8B (MTEB #1, halfvec 4000维)
const AI_302_API_KEY = process.env.AI_302_API_KEY || "";
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "Qwen/Qwen3-Embedding-8B";
const EMBEDDING_DIMENSIONS = parseInt(
  process.env.EMBEDDING_DIMENSIONS || "4000",
);

// 302.ai Reranker 配置 - Qwen3-Reranker-8B (二阶段重排序)
const RERANKER_MODEL = process.env.RERANKER_MODEL || "Qwen/Qwen3-Reranker-8B";
const RERANKER_ENABLED = process.env.RERANKER_ENABLED === "true";

// ============================================
// AI SDK 6.x Embedding Provider
// ============================================
const openai = AI_302_API_KEY
  ? createOpenAI({
      baseURL: "https://api.302.ai/v1",
      apiKey: AI_302_API_KEY,
    })
  : null;

const embeddingModel = openai ? openai.embedding(EMBEDDING_MODEL) : null;

// AI SDK 6.x 单文本 embedding
async function embedText(text: string): Promise<number[]> {
  if (!embeddingModel) {
    console.warn("[RAG] No embedding model configured");
    return [];
  }

  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: text,
    });
    // MRL 截断: Qwen3 支持 Matryoshka，前 N 维保持语义完整
    return embedding.slice(0, EMBEDDING_DIMENSIONS);
  } catch (err) {
    console.error("[RAG] Embed error:", err);
    throw err;
  }
}

// AI SDK 6.x 批量 embedding (自动分块)
async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!embeddingModel) {
    console.warn("[RAG] No embedding model configured");
    return texts.map(() => []);
  }

  try {
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: texts,
    });
    // MRL 截断: Qwen3 支持 Matryoshka，前 N 维保持语义完整
    return embeddings.map((e) => e.slice(0, EMBEDDING_DIMENSIONS));
  } catch (err) {
    console.error("[RAG] EmbedMany error:", err);
    throw err;
  }
}

// ============================================
// Reranker - 二阶段重排序 (显著提升检索精度)
// ============================================
interface RerankResult {
  index: number;
  relevance_score: number;
}

async function rerank(
  query: string,
  documents: string[],
  topN = 5,
): Promise<RerankResult[]> {
  if (!RERANKER_ENABLED || !AI_302_API_KEY) {
    return documents.map((_, i) => ({
      index: i,
      relevance_score: 1 - i * 0.1,
    }));
  }

  try {
    const response = await fetch("https://api.302.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_302_API_KEY}`,
      },
      body: JSON.stringify({
        model: RERANKER_MODEL,
        query,
        documents,
        top_n: topN,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Reranker] Error:", response.status, err);
      return documents.map((_, i) => ({
        index: i,
        relevance_score: 1 - i * 0.1,
      }));
    }

    const data = await response.json();
    return data.results || data.data || [];
  } catch (err) {
    console.error("[Reranker] Failed:", err);
    return documents.map((_, i) => ({
      index: i,
      relevance_score: 1 - i * 0.1,
    }));
  }
}

// ============================================
// 数据库 Schema
// ============================================
const client = postgres(DATABASE_URL);
const db = drizzle(client);

// ============================================
// 智能文本分块
// ============================================
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      const sentences = paragraph.split(/(?<=[.!?。！？])\s+/);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > CHUNK_SIZE) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += " " + sentence;
        }
      }
    } else if (currentChunk.length + paragraph.length > CHUNK_SIZE) {
      chunks.push(currentChunk.trim());
      currentChunk = currentChunk.slice(-CHUNK_OVERLAP) + " " + paragraph;
    } else {
      currentChunk += "\n\n" + paragraph;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.filter((c) => c.length > 20);
}

// ============================================
// RAG Service - AI SDK 6.x
// ============================================
@Injectable()
export class RagService implements OnModuleInit {
  private worker: Worker | null = null;

  async onModuleInit() {
    console.log("[RAG] 2026 Architecture - AI SDK 6.x");
    console.log(`[RAG] Model: ${EMBEDDING_MODEL}`);
    console.log(`[RAG] Dimensions: ${EMBEDDING_DIMENSIONS}`);
    console.log(`[RAG] Provider: 302.ai`);
    await this.startWorker();
  }

  private async startWorker() {
    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    this.worker = new Worker(
      "rag-index",
      async (job: Job) => {
        const { documentId, plainText } = job.data;
        console.log(`[RAG] Processing: ${documentId}`);
        try {
          await this.indexDocument(documentId, plainText);
        } catch (err) {
          console.error(`[RAG] Failed: ${documentId}`, err);
          throw err;
        }
      },
      { connection: connection as any, concurrency: 2 },
    );

    this.worker.on("completed", (job) => console.log(`[RAG] Done: ${job.id}`));
    this.worker.on("failed", (job, err) =>
      console.error(`[RAG] Failed: ${job?.id}`, err.message),
    );
    console.log("[RAG Worker] Started");
  }

  async indexDocument(documentId: string, plainText: string) {
    if (!plainText || plainText.trim().length < 20) return;

    const chunks = splitIntoChunks(plainText);
    if (chunks.length === 0) return;

    console.log(`[RAG] Indexing ${chunks.length} chunks with AI SDK 6.x`);

    // 使用 AI SDK embedMany
    const embeddings = await embedTexts(chunks);
    if (embeddings[0]?.length === 0) {
      console.log("[RAG] Skipped (no embedding model)");
      return;
    }

    // 删除旧 chunks
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    // 插入新 chunks
    const values = chunks.map((content, i) => ({
      documentId,
      content,
      embedding: embeddings[i],
      chunkIndex: i,
    }));

    for (let i = 0; i < values.length; i += 50) {
      await db.insert(documentChunks).values(values.slice(i, i + 50));
    }

    console.log(`[RAG] Indexed: ${documentId}`);
  }

  async retrieve(
    query: string,
    topK = 5,
  ): Promise<
    Array<{ content: string; documentId: string; similarity: number }>
  > {
    // Step 1: 向量检索 (召回更多候选)
    const embedding = await embedText(query);
    if (embedding.length === 0) return [];

    const embeddingStr = `[${embedding.join(",")}]`;
    const candidateCount = RERANKER_ENABLED ? topK * 4 : topK; // Reranker 需要更多候选

    const candidates = (await db.execute(sql`
      SELECT content, document_id as "documentId",
             1 - (embedding <=> ${embeddingStr}::halfvec) as similarity
      FROM document_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::halfvec
      LIMIT ${candidateCount}
    `)) as unknown as Array<{
      content: string;
      documentId: string;
      similarity: number;
    }>;

    if (candidates.length === 0) return [];

    // Step 2: Reranker 重排序 (显著提升精度)
    if (RERANKER_ENABLED && candidates.length > 1) {
      console.log(
        `[RAG] Reranking ${candidates.length} candidates with ${RERANKER_MODEL}`,
      );
      const rerankResults = await rerank(
        query,
        candidates.map((c) => c.content),
        topK,
      );

      // 按 rerank 分数重排
      const reranked = rerankResults
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, topK)
        .map((r) => ({
          ...candidates[r.index],
          similarity: r.relevance_score,
        }));

      return reranked;
    }

    return candidates.slice(0, topK);
  }

  async getDocumentTitle(documentId: string): Promise<string> {
    const result = await db
      .select({ title: documents.title })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    return result[0]?.title || "Untitled";
  }

  // 获取需要重新索引的文档（模型切换后）
  // 注意：我们在 schema 中移除了 embeddingModel 字段，如果需要追踪模型版本，需要加回该字段
  async getOutdatedDocuments(): Promise<string[]> {
    // 临时方案：仅返回前100个文档，强制重新索引
    // 长期方案：建议在 document_chunks 表中加回 embedding_model 字段或在 documents 表中记录最后索引使用的模型
    const results = await db
      .selectDistinct({ documentId: documentChunks.documentId })
      .from(documentChunks)
      .limit(100);
    return results.map((r) => r.documentId).filter(Boolean) as string[];
  }
}

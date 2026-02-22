/**
 * Knowledge Chunker - 统一知识分块与索引
 *
 * 将内容分块并生成向量嵌入，支持多种来源：
 * - document: 文档
 * - conversation: 聊天会话
 */

import { db, documents, eq, knowledgeChunks } from "@nexusnote/db";
import { embedMany } from "ai";
import { aiProvider } from "../provider";

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export type SourceType = "document" | "conversation";

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;

    if (start >= text.length) {
      break;
    }
  }

  return chunks;
}

interface IndexOptions extends ChunkOptions {
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function indexDocument(
  documentId: string,
  plainText: string,
  options: IndexOptions = {},
): Promise<{ success: boolean; chunksCount: number }> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP, userId, metadata } = options;

  console.log(`[Chunker] Indexing document: ${documentId}, text length: ${plainText.length}`);

  try {
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, documentId));
    console.log(`[Chunker] Cleared old chunks for: ${documentId}`);

    const chunks = chunkText(plainText, chunkSize, overlap);
    console.log(`[Chunker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: chunks,
    });

    console.log(`[Chunker] Generated ${embeddings.length} embeddings`);

    const newChunks = chunks.map((content, index) => ({
      sourceType: "document" as SourceType,
      sourceId: documentId,
      content,
      embedding: embeddings[index],
      chunkIndex: index,
      userId: userId || null,
      metadata: metadata || null,
    }));

    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      await db.insert(knowledgeChunks).values(batch);
    }

    console.log(`[Chunker] ✅ Indexed ${chunks.length} chunks for: ${documentId}`);

    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    console.error(`[Chunker] ❌ Error indexing document:`, error);
    throw error;
  }
}

export async function indexConversation(
  conversationId: string,
  plainText: string,
  userId: string,
  options: IndexOptions = {},
): Promise<{ success: boolean; chunksCount: number }> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP, metadata } = options;

  console.log(
    `[Chunker] Indexing conversation: ${conversationId}, text length: ${plainText.length}`,
  );

  try {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, conversationId));
    console.log(`[Chunker] Cleared old chunks for: ${conversationId}`);

    const chunks = chunkText(plainText, chunkSize, overlap);
    console.log(`[Chunker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: chunks,
    });

    console.log(`[Chunker] Generated ${embeddings.length} embeddings`);

    const newChunks = chunks.map((content, index) => ({
      sourceType: "conversation" as SourceType,
      sourceId: conversationId,
      content,
      embedding: embeddings[index],
      chunkIndex: index,
      userId,
      metadata: metadata || null,
    }));

    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      await db.insert(knowledgeChunks).values(batch);
    }

    console.log(`[Chunker] ✅ Indexed ${chunks.length} chunks for: ${conversationId}`);

    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    console.error(`[Chunker] ❌ Error indexing conversation:`, error);
    throw error;
  }
}

export async function reindexAllDocuments(): Promise<{ success: boolean; processed: number }> {
  const allDocs = await db.query.documents.findMany();

  let processed = 0;
  for (const doc of allDocs) {
    try {
      await indexDocument(doc.id, doc.plainText || "");
      processed++;
    } catch (error) {
      console.error(`[Chunker] Failed to index ${doc.id}:`, error);
    }
  }

  return { success: true, processed };
}

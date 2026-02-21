/**
 * Document Chunker - 文档分块与索引
 *
 * 将文档内容分块并生成向量嵌入
 * 用于 RAG 检索
 */

import { db, documentChunks, documents, eq } from "@nexusnote/db";
import { embedMany } from "ai";
import { aiProvider } from "../provider";

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

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

export async function indexDocument(
  documentId: string,
  plainText: string,
  options: ChunkOptions = {},
): Promise<{ success: boolean; chunksCount: number }> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = options;

  console.log(`[Chunker] Indexing document: ${documentId}, text length: ${plainText.length}`);

  try {
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // 清理旧的 chunks
    await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
    console.log(`[Chunker] Cleared old chunks for: ${documentId}`);

    // 分块
    const chunks = chunkText(plainText, chunkSize, overlap);
    console.log(`[Chunker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    // 生成嵌入
    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: chunks,
    });

    console.log(`[Chunker] Generated ${embeddings.length} embeddings`);

    // 插入数据库
    const newChunks = chunks.map((content, index) => ({
      documentId,
      content,
      embedding: embeddings[index],
      chunkIndex: index,
    }));

    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      await db.insert(documentChunks).values(batch).onConflictDoNothing();
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

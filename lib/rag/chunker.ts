/**
 * RAG Service - Knowledge Chunker
 *
 * Unified knowledge chunking and indexing for multiple sources:
 * - note: Notes
 * - conversation: Chat conversations
 */

import { embedMany } from "ai";
import { db, eq, knowledgeChunks, notes } from "@/db";
import { aiProvider } from "@/lib/ai";

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export type SourceType = "note" | "conversation" | "course_section";

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

export async function indexNote(
  noteId: string,
  plainText: string,
  options: IndexOptions = {},
): Promise<{ success: boolean; chunksCount: number }> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP, userId, metadata } = options;

  console.log(`[Chunker] Indexing note: ${noteId}, text length: ${plainText.length}`);

  try {
    const note = await db.query.notes.findFirst({
      where: eq(notes.id, noteId),
    });

    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, noteId));
    console.log(`[Chunker] Cleared old chunks for: ${noteId}`);

    const chunks = chunkText(plainText, chunkSize, overlap);
    console.log(`[Chunker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel,
      values: chunks,
    });

    console.log(`[Chunker] Generated ${embeddings.length} embeddings`);

    const newChunks = chunks.map((content, index) => ({
      sourceType: "note" as const,
      sourceId: noteId,
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

    console.log(`[Chunker] Indexed ${chunks.length} chunks for: ${noteId}`);

    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    console.error(`[Chunker] Error indexing note:`, error);
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
    console.log("[Chunker] Deleting old chunks...");
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, conversationId));
    console.log(`[Chunker] Cleared old chunks for: ${conversationId}`);

    const chunks = chunkText(plainText, chunkSize, overlap);
    console.log(`[Chunker] Created ${chunks.length} chunks:`, chunks);

    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    console.log("[Chunker] Starting embedMany...", { count: chunks.length });
    const startTime = Date.now();
    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel,
      values: chunks,
    });
    console.log(
      `[Chunker] Generated ${embeddings.length} embeddings, took ${Date.now() - startTime}ms`,
    );

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

    console.log(`[Chunker] Indexed ${chunks.length} chunks for: ${conversationId}`);

    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    console.error(`[Chunker] Error indexing conversation:`, error);
    throw error;
  }
}

export async function indexCourseSection(
  documentId: string,
  plainText: string,
  userId: string,
  courseId: string,
  options: IndexOptions = {},
): Promise<{ success: boolean; chunksCount: number }> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP, metadata } = options;

  console.log(
    `[Chunker] Indexing course section: ${documentId}, courseId: ${courseId}, text length: ${plainText.length}`,
  );

  try {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, documentId));

    const chunks = chunkText(plainText, chunkSize, overlap);
    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel,
      values: chunks,
    });

    const newChunks = chunks.map((content, index) => ({
      sourceType: "course_section" as SourceType,
      sourceId: documentId,
      content,
      embedding: embeddings[index],
      chunkIndex: index,
      userId,
      metadata: { ...metadata, courseId },
    }));

    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      await db.insert(knowledgeChunks).values(batch);
    }

    console.log(`[Chunker] Indexed ${chunks.length} course section chunks for: ${documentId}`);
    return { success: true, chunksCount: chunks.length };
  } catch (error) {
    console.error(`[Chunker] Error indexing course section:`, error);
    throw error;
  }
}

export async function reindexAllNotes(): Promise<{ success: boolean; processed: number }> {
  const allNotes = await db.query.notes.findMany();

  let processed = 0;
  for (const note of allNotes) {
    try {
      await indexNote(note.id, note.plainText || "");
      processed++;
    } catch (error) {
      console.error(`[Chunker] Failed to index ${note.id}:`, error);
    }
  }

  return { success: true, processed };
}

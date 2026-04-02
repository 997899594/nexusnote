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
import { createRagTrace } from "./observability";

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export type SourceType = "note" | "conversation" | "course_section";

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

async function createEmbeddingsOrNull(
  chunks: string[],
  context: string,
): Promise<(number[] | null)[]> {
  if (!aiProvider.isConfigured()) {
    console.warn(`[Chunker] AI provider not configured, skip embeddings for ${context}`);
    return chunks.map(() => null);
  }

  try {
    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel,
      values: chunks,
    });

    if (embeddings.length !== chunks.length) {
      console.warn(
        `[Chunker] Embedding count mismatch for ${context}: chunks=${chunks.length}, embeddings=${embeddings.length}`,
      );
    }

    return chunks.map((_, index) => embeddings[index] ?? null);
  } catch (error) {
    console.error(
      `[Chunker] Embedding unavailable for ${context}, fallback to keyword-only:`,
      error,
    );
    return chunks.map(() => null);
  }
}

export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const safeChunkSize = Math.max(1, chunkSize);
  const safeOverlap = Math.max(0, Math.min(overlap, safeChunkSize - 1));
  const step = safeChunkSize - safeOverlap;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + safeChunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    start += step;
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
  const trace = createRagTrace("index-note", {
    noteId,
    textLength: plainText.length,
    hasUserId: Boolean(userId),
  });

  try {
    const note = await db.query.notes.findFirst({
      where: eq(notes.id, noteId),
    });

    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, noteId));
    trace.step("delete-old-chunks");

    const chunks = chunkText(plainText, chunkSize, overlap);
    trace.step("chunked", { chunksCount: chunks.length, chunkSize, overlap });

    if (chunks.length === 0) {
      trace.finish({ chunksCount: 0, embeddingsCount: 0 });
      return { success: true, chunksCount: 0 };
    }

    const embeddings = await createEmbeddingsOrNull(chunks, `note:${noteId}`);
    const embeddingsCount = embeddings.filter((item) => item !== null).length;
    trace.step("embedded", { embeddingsCount, chunksCount: chunks.length });

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
    trace.finish({ chunksCount: chunks.length, embeddingsCount });

    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    trace.fail(error, { noteId });
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
  const trace = createRagTrace("index-conversation", {
    conversationId,
    textLength: plainText.length,
    userId,
  });

  try {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, conversationId));
    trace.step("delete-old-chunks");

    const chunks = chunkText(plainText, chunkSize, overlap);
    trace.step("chunked", { chunksCount: chunks.length, chunkSize, overlap });

    if (chunks.length === 0) {
      trace.finish({ chunksCount: 0, embeddingsCount: 0 });
      return { success: true, chunksCount: 0 };
    }

    const startTime = Date.now();
    const embeddings = await createEmbeddingsOrNull(chunks, `conversation:${conversationId}`);
    const embeddingsCount = embeddings.filter((item) => item !== null).length;
    trace.step("embedded", {
      chunksCount: chunks.length,
      embeddingsCount,
      embeddingMs: Date.now() - startTime,
    });

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
    trace.finish({ chunksCount: chunks.length, embeddingsCount });

    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    trace.fail(error, { conversationId });
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
  const trace = createRagTrace("index-course-section", {
    documentId,
    courseId,
    textLength: plainText.length,
    userId,
  });

  try {
    await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, documentId));
    trace.step("delete-old-chunks");

    const chunks = chunkText(plainText, chunkSize, overlap);
    trace.step("chunked", { chunksCount: chunks.length, chunkSize, overlap });
    if (chunks.length === 0) {
      trace.finish({ chunksCount: 0, embeddingsCount: 0 });
      return { success: true, chunksCount: 0 };
    }

    const embeddings = await createEmbeddingsOrNull(chunks, `course_section:${documentId}`);
    const embeddingsCount = embeddings.filter((item) => item !== null).length;
    trace.step("embedded", { chunksCount: chunks.length, embeddingsCount });

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
    trace.finish({ chunksCount: chunks.length, embeddingsCount });
    return { success: true, chunksCount: chunks.length };
  } catch (error) {
    trace.fail(error, { documentId, courseId });
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

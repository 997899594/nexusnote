/**
 * RAG Service - Knowledge Evidence Chunker
 *
 * Unified chunking and indexing for searchable evidence sources:
 * - note
 * - capture
 * - conversation
 * - course_section
 */

import { embedMany } from "ai";
import { and, db, eq, inArray, knowledgeEvidence, knowledgeEvidenceChunks } from "@/db";
import { aiProvider } from "@/lib/ai";
import { buildSourceVersionCondition } from "@/lib/growth/source-version";
import {
  groupEvidenceSourceLinksByEvidenceId,
  listEvidenceSourceLinks,
} from "@/lib/knowledge/evidence/source-links";
import { createRagTrace } from "./observability";

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export type SourceType = "note" | "capture" | "conversation" | "course_section";

interface SyncSourceKnowledgeEvidenceChunksOptions extends ChunkOptions {
  userId: string;
  sourceType: SourceType;
  sourceId: string;
  sourceVersionHash?: string | null;
  metadata?: Record<string, unknown>;
}

interface SearchableEvidenceRow {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  summary: string;
}

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

function uniqueTextParts(parts: Array<string | null | undefined>): string[] {
  const values = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const normalized = part?.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    values.push(normalized);
  }

  return values;
}

function buildEvidenceChunkContent(
  evidence: SearchableEvidenceRow,
  refs: Array<{ snippet: string | null }>,
): string {
  return uniqueTextParts([
    evidence.title,
    evidence.summary,
    ...refs.map((ref) => ref.snippet),
  ]).join("\n\n");
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

async function deleteChunksByEvidenceIds(evidenceIds: string[]): Promise<void> {
  if (evidenceIds.length === 0) {
    return;
  }

  await db
    .delete(knowledgeEvidenceChunks)
    .where(inArray(knowledgeEvidenceChunks.knowledgeEvidenceId, evidenceIds));
}

export async function syncSourceKnowledgeEvidenceChunks(
  options: SyncSourceKnowledgeEvidenceChunksOptions,
): Promise<{ success: boolean; chunksCount: number; evidenceCount: number }> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    userId,
    sourceType,
    sourceId,
    sourceVersionHash,
    metadata,
  } = options;
  const trace = createRagTrace("sync-source-evidence-chunks", {
    userId,
    sourceType,
    sourceId,
    sourceVersionHash: sourceVersionHash ?? null,
  });

  try {
    const evidenceRows = await db
      .select({
        id: knowledgeEvidence.id,
        sourceType: knowledgeEvidence.sourceType,
        sourceId: knowledgeEvidence.sourceId,
        title: knowledgeEvidence.title,
        summary: knowledgeEvidence.summary,
      })
      .from(knowledgeEvidence)
      .where(
        and(
          eq(knowledgeEvidence.userId, userId),
          eq(knowledgeEvidence.sourceType, sourceType),
          eq(knowledgeEvidence.sourceId, sourceId),
          buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, sourceVersionHash),
        ),
      );

    if (evidenceRows.length === 0) {
      trace.finish({ evidenceCount: 0, chunksCount: 0 });
      return { success: true, chunksCount: 0, evidenceCount: 0 };
    }

    const evidenceIds = evidenceRows.map((row) => row.id);
    const refsByEvidenceId = groupEvidenceSourceLinksByEvidenceId(
      await listEvidenceSourceLinks({ evidenceIds }),
    );

    await deleteChunksByEvidenceIds(evidenceIds);
    trace.step("delete-old-chunks", { evidenceCount: evidenceRows.length });

    let totalChunks = 0;
    for (const evidence of evidenceRows) {
      const searchableContent = buildEvidenceChunkContent(
        evidence,
        refsByEvidenceId.get(evidence.id) ?? [],
      );
      const chunks = chunkText(searchableContent, chunkSize, overlap);
      if (chunks.length === 0) {
        continue;
      }

      const embeddings = await createEmbeddingsOrNull(
        chunks,
        `${sourceType}:${sourceId}:${evidence.id}`,
      );
      const newChunks = chunks.map((content, index) => ({
        knowledgeEvidenceId: evidence.id,
        content,
        embedding: embeddings[index],
        chunkIndex: index,
        metadata: {
          ...metadata,
          sourceType: evidence.sourceType,
          sourceId: evidence.sourceId,
        },
      }));

      const batchSize = 50;
      for (let offset = 0; offset < newChunks.length; offset += batchSize) {
        await db
          .insert(knowledgeEvidenceChunks)
          .values(newChunks.slice(offset, offset + batchSize));
      }

      totalChunks += chunks.length;
    }

    trace.finish({
      evidenceCount: evidenceRows.length,
      chunksCount: totalChunks,
    });

    return {
      success: true,
      chunksCount: totalChunks,
      evidenceCount: evidenceRows.length,
    };
  } catch (error) {
    trace.fail(error, {
      userId,
      sourceType,
      sourceId,
    });
    throw error;
  }
}

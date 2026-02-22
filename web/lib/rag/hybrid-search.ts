/**
 * RAG Service - Hybrid Search
 *
 * Combines vector search + keyword search + RRF merging + Query Rewriter
 * Supports multiple sources: document | conversation
 */

import { embedMany } from "ai";
import { db, sql } from "@/db";
import { aiProvider } from "@/lib/ai";
import type { SourceType } from "./chunker";
import { rewriteQuery } from "./query-rewriter";

export interface HybridSearchResult {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  content: string;
  score: number;
  source: "vector" | "keyword" | "both";
}

export interface HybridSearchOptions {
  topK?: number;
  sourceTypes?: SourceType[];
  userId?: string;
  conversationContext?: string;
}

async function vectorSearch(
  query: string,
  topK: number,
  sourceTypes?: SourceType[],
  userId?: string,
): Promise<
  Array<{
    id: string;
    sourceId: string;
    sourceType: SourceType;
    content: string;
    similarity: number;
  }>
> {
  if (!aiProvider.isConfigured()) {
    console.warn("[RAG] Provider not configured, skipping vector search");
    return [];
  }

  try {
    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: [query],
    });

    const queryEmbedding = embeddings[0];
    if (!queryEmbedding) return [];

    const sourceTypeFilter =
      sourceTypes && sourceTypes.length > 0
        ? sql`AND source_type IN ${sql.raw(`(${sourceTypes.map((t) => `'${t}'`).join(", ")})`)}`
        : sql``;

    const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;

    const results = await db.execute<{
      id: string;
      source_id: string;
      source_type: SourceType;
      content: string;
      similarity: number;
    }>(sql`
      SELECT
        id,
        source_id,
        source_type,
        content,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec) as similarity
      FROM knowledge_chunks
      WHERE embedding IS NOT NULL
      ${sourceTypeFilter}
      ${userFilter}
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec
      LIMIT ${topK}
    `);

    return results.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceType: r.source_type,
      content: r.content,
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error("[RAG] vectorSearch error:", error);
    return [];
  }
}

async function keywordSearch(
  query: string,
  topK: number,
  sourceTypes?: SourceType[],
  userId?: string,
): Promise<
  Array<{ id: string; sourceId: string; sourceType: SourceType; content: string; rank: number }>
> {
  try {
    const sourceTypeFilter =
      sourceTypes && sourceTypes.length > 0
        ? sql`AND source_type IN ${sql.raw(`(${sourceTypes.map((t) => `'${t}'`).join(", ")})`)}`
        : sql``;

    const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;

    const results = await db.execute<{
      id: string;
      source_id: string;
      source_type: SourceType;
      content: string;
      rank: number;
    }>(sql`
      SELECT
        id,
        source_id,
        source_type,
        content,
        ts_rank(
          to_tsvector('simple', content),
          plainto_tsquery('simple', ${query})
        ) as rank
      FROM knowledge_chunks
      WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', ${query})
      ${sourceTypeFilter}
      ${userFilter}
      ORDER BY rank DESC
      LIMIT ${topK}
    `);

    return results.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceType: r.source_type,
      content: r.content,
      rank: r.rank,
    }));
  } catch (error) {
    console.error("[RAG] keywordSearch error:", error);
    return [];
  }
}

function reciprocalRankFusion(
  vectorResults: Array<{ id: string; sourceId: string; sourceType: SourceType; content: string }>,
  keywordResults: Array<{ id: string; sourceId: string; sourceType: SourceType; content: string }>,
  topK: number,
): HybridSearchResult[] {
  const k = 60;
  const scores = new Map<string, { score: number; result: HybridSearchResult }>();

  vectorResults.forEach((result, rank) => {
    scores.set(result.id, {
      score: 1 / (k + rank + 1),
      result: {
        id: result.id,
        sourceId: result.sourceId,
        sourceType: result.sourceType,
        content: result.content,
        score: 0,
        source: "vector",
      },
    });
  });

  keywordResults.forEach((result, rank) => {
    const existing = scores.get(result.id);
    const rrfScore = 1 / (k + rank + 1);

    if (existing) {
      existing.score += rrfScore;
      existing.result.source = "both";
    } else {
      scores.set(result.id, {
        score: rrfScore,
        result: {
          id: result.id,
          sourceId: result.sourceId,
          sourceType: result.sourceType,
          content: result.content,
          score: 0,
          source: "keyword",
        },
      });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({ ...s.result, score: s.score }));
}

export async function hybridSearch(
  queryOrOptions: string | (HybridSearchOptions & { query: string }),
  topKOrUndefined?: number,
  conversationContextOrUndefined?: string,
): Promise<HybridSearchResult[]> {
  let query: string;
  let options: HybridSearchOptions = {};

  if (typeof queryOrOptions === "string") {
    query = queryOrOptions;
    options = { topK: topKOrUndefined ?? 5, conversationContext: conversationContextOrUndefined };
  } else {
    query = queryOrOptions.query;
    options = queryOrOptions;
  }

  const { topK: k = 5, sourceTypes, userId, conversationContext: ctx } = options;

  const rewrittenQuery = await rewriteQuery(query, ctx);

  const [vResults, kResults] = await Promise.all([
    vectorSearch(rewrittenQuery, k * 2, sourceTypes, userId),
    keywordSearch(rewrittenQuery, k * 2, sourceTypes, userId),
  ]);

  return reciprocalRankFusion(vResults, kResults, k);
}

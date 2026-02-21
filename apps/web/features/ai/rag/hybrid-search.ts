/**
 * Hybrid Search — 向量搜索 + 关键词搜索 + RRF 合并 + Query Rewriter
 *
 * 复用 Legacy 架构
 */

import { db, sql } from "@nexusnote/db";
import { embedMany } from "ai";
import { aiProvider } from "../provider";
import { rewriteQuery } from "./query-rewriter";

export interface HybridSearchResult {
  id: string;
  documentId: string;
  content: string;
  score: number;
  source: "vector" | "keyword" | "both";
}

async function vectorSearch(
  query: string,
  topK: number,
): Promise<Array<{ id: string; documentId: string; content: string; similarity: number }>> {
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

    const results = await db.execute<{
      id: string;
      document_id: string;
      content: string;
      similarity: number;
    }>(sql`
      SELECT
        id,
        document_id,
        content,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec) as similarity
      FROM document_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec
      LIMIT ${topK}
    `);

    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
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
): Promise<Array<{ id: string; documentId: string; content: string; rank: number }>> {
  try {
    const results = await db.execute<{
      id: string;
      document_id: string;
      content: string;
      rank: number;
    }>(sql`
      SELECT
        id,
        document_id,
        content,
        ts_rank(
          to_tsvector('simple', content),
          plainto_tsquery('simple', ${query})
        ) as rank
      FROM document_chunks
      WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', ${query})
      ORDER BY rank DESC
      LIMIT ${topK}
    `);

    return results.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      content: r.content,
      rank: r.rank,
    }));
  } catch (error) {
    console.error("[RAG] keywordSearch error:", error);
    return [];
  }
}

function reciprocalRankFusion(
  vectorResults: Array<{ id: string; documentId: string; content: string }>,
  keywordResults: Array<{ id: string; documentId: string; content: string }>,
  topK: number,
): HybridSearchResult[] {
  const k = 60;
  const scores = new Map<string, { score: number; result: HybridSearchResult }>();

  vectorResults.forEach((result, rank) => {
    scores.set(result.id, {
      score: 1 / (k + rank + 1),
      result: {
        id: result.id,
        documentId: result.documentId,
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
          documentId: result.documentId,
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
  query: string,
  topK: number = 5,
  conversationContext?: string,
): Promise<HybridSearchResult[]> {
  const rewrittenQuery = await rewriteQuery(query, conversationContext);

  const [vResults, kResults] = await Promise.all([
    vectorSearch(rewrittenQuery, topK * 2),
    keywordSearch(rewrittenQuery, topK * 2),
  ]);

  return reciprocalRankFusion(vResults, kResults, topK);
}

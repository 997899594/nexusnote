/**
 * Hybrid Search — 向量搜索 + 关键词搜索 + RRF 合并
 *
 * 纯向量搜索在精确匹配（代码片段、术语名）上表现差。
 * 结合 PostgreSQL 全文搜索兜底，用 Reciprocal Rank Fusion 合并排名。
 */

import { db, sql } from "@nexusnote/db";
import { embedMany } from "ai";
import { isEmbeddingConfigured, registry } from "../registry";

// ============================================
// 类型定义
// ============================================

export interface HybridSearchResult {
  id: string;
  documentId: string;
  content: string;
  /** RRF 融合分数 */
  score: number;
  /** 来源标记：vector / keyword / both */
  source: "vector" | "keyword" | "both";
}

// ============================================
// 向量搜索
// ============================================

async function vectorSearch(
  query: string,
  topK: number,
): Promise<Array<{ id: string; documentId: string; content: string; similarity: number }>> {
  if (!isEmbeddingConfigured() || !registry.embeddingModel) {
    return [];
  }

  // 生成查询向量
  const { embeddings } = await embedMany({
    model: registry.embeddingModel,
    values: [query],
  });

  const queryEmbedding = embeddings[0];
  if (!queryEmbedding) return [];

  // 余弦相似度搜索（使用 HNSW 索引）
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
}

// ============================================
// 关键词搜索（PostgreSQL ts_rank）
// ============================================

async function keywordSearch(
  query: string,
  topK: number,
): Promise<Array<{ id: string; documentId: string; content: string; rank: number }>> {
  // 使用 simple 配置（适用于中英文混合）
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
}

// ============================================
// Reciprocal Rank Fusion (RRF)
// ============================================

/**
 * RRF 合并多个排名列表
 *
 * RRF 公式：score(d) = Σ 1 / (k + rank_i(d))
 * 其中 k = 60（标准常数，平衡高排名和低排名的影响）
 */
function reciprocalRankFusion(
  vectorResults: Array<{ id: string; documentId: string; content: string }>,
  keywordResults: Array<{ id: string; documentId: string; content: string }>,
  topK: number,
): HybridSearchResult[] {
  const k = 60; // RRF 常数
  const scores = new Map<string, { score: number; result: HybridSearchResult }>();

  // 向量搜索结果的 RRF 分数
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

  // 关键词搜索结果的 RRF 分数（叠加）
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

  // 按 RRF 分数排序，取 topK
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({ ...s.result, score: s.score }));
}

// ============================================
// 公共 API
// ============================================

/**
 * 混合搜索：向量 + 关键词，RRF 融合
 *
 * @param query 搜索查询（建议经过 queryRewriter 处理）
 * @param topK 返回结果数量
 * @returns 融合排序后的搜索结果
 */
export async function hybridSearch(query: string, topK: number = 5): Promise<HybridSearchResult[]> {
  // 并行执行向量搜索和关键词搜索
  const [vResults, kResults] = await Promise.all([
    vectorSearch(query, topK * 2), // 多取一些用于融合
    keywordSearch(query, topK * 2),
  ]);

  // RRF 合并
  return reciprocalRankFusion(vResults, kResults, topK);
}

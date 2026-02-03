/**
 * Hybrid Search Module
 *
 * 结合向量检索和全文搜索（BM25-like）：
 * - Vector Search: 语义相似度
 * - Full-text Search: 关键词精确匹配
 * - RRF (Reciprocal Rank Fusion): 合并两种检索结果
 */

import { sql } from '@nexusnote/db';
import { db } from '../database/database.module';

// ============================================
// Types
// ============================================

interface SearchResult {
  content: string;
  documentId: string;
  similarity: number;
  rank?: number; // 用于 RRF
}

// ============================================
// Reciprocal Rank Fusion (RRF)
// ============================================

/**
 * RRF 算法：合并多个排序列表
 *
 * Formula: score(d) = Σ 1 / (k + rank(d))
 * - k: 常数（通常为 60）
 * - rank(d): 文档在列表中的排名（从 1 开始）
 *
 * 优点：
 * - 不需要归一化分数
 * - 对异常值不敏感
 * - 简单且有效
 */
function reciprocalRankFusion(
  results: Array<Array<SearchResult>>,
  k: number = 60,
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; score: number }>();

  // 为每个结果列表中的文档计算 RRF 分数
  for (const resultList of results) {
    resultList.forEach((result, rank) => {
      const key = `${result.documentId}-${result.content.slice(0, 50)}`; // 组合 key
      const rrfScore = 1 / (k + rank + 1); // rank 从 0 开始，所以 +1

      if (scoreMap.has(key)) {
        const existing = scoreMap.get(key)!;
        existing.score += rrfScore; // 累加分数
      } else {
        scoreMap.set(key, { result, score: rrfScore });
      }
    });
  }

  // 按 RRF 分数排序
  const merged = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, score }) => ({
      ...result,
      similarity: score, // 使用 RRF 分数作为相似度
    }));

  return merged;
}

// ============================================
// Full-text Search (PostgreSQL ts_vector)
// ============================================

/**
 * 使用 PostgreSQL 全文搜索进行关键词检索
 *
 * @param query 搜索查询
 * @param userId 用户 ID
 * @param topK 返回结果数量
 * @returns 全文搜索结果
 */
export async function fullTextSearch(
  query: string,
  userId: string,
  topK: number = 20,
): Promise<SearchResult[]> {
  try {
    // PostgreSQL 全文搜索（中英文支持）
    // ts_rank_cd: 考虑词频和位置的排名函数
    const results = (await db.execute(sql`
      SELECT
        c.content,
        c.document_id as "documentId",
        ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ${query})) as similarity
      FROM document_chunks c
      JOIN documents d ON c.document_id = d.id
      JOIN workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = ${userId}::uuid
        AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ${query})
      ORDER BY similarity DESC
      LIMIT ${topK}
    `)) as unknown as SearchResult[];

    console.log(`[Hybrid Search] Full-text found ${results.length} results`);
    return results;
  } catch (err) {
    console.error('[Hybrid Search] Full-text search failed:', err);
    return [];
  }
}

// ============================================
// Hybrid Search
// ============================================

export interface HybridSearchOptions {
  /** 向量检索权重（0-1），剩余为全文搜索权重 */
  vectorWeight?: number;
  /** RRF 参数 k */
  rrfK?: number;
  /** 每种检索方法的候选数量 */
  candidatesPerMethod?: number;
}

/**
 * 混合检索：向量检索 + 全文搜索 + RRF 融合
 *
 * @param query 搜索查询
 * @param queryEmbedding 查询的向量表示
 * @param userId 用户 ID
 * @param topK 最终返回数量
 * @param options 混合检索选项
 * @returns 融合后的检索结果
 */
export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  userId: string,
  topK: number,
  options: HybridSearchOptions = {},
): Promise<SearchResult[]> {
  const {
    vectorWeight = 0.7,
    rrfK = 60,
    candidatesPerMethod = topK * 2,
  } = options;

  // 并行执行向量检索和全文搜索
  const [vectorResults, fullTextResults] = await Promise.all([
    // 向量检索
    vectorSearch(queryEmbedding, userId, candidatesPerMethod),
    // 全文搜索
    fullTextSearch(query, userId, candidatesPerMethod),
  ]);

  console.log(
    `[Hybrid Search] Vector: ${vectorResults.length}, Full-text: ${fullTextResults.length}`
  );

  // 如果其中一个没有结果，直接返回另一个
  if (vectorResults.length === 0) return fullTextResults.slice(0, topK);
  if (fullTextResults.length === 0) return vectorResults.slice(0, topK);

  // 使用 RRF 融合结果
  const merged = reciprocalRankFusion([vectorResults, fullTextResults], rrfK);

  console.log(`[Hybrid Search] Merged ${merged.length} results with RRF`);

  return merged.slice(0, topK);
}

/**
 * 向量检索（从 rag.service.ts 提取）
 */
async function vectorSearch(
  embedding: number[],
  userId: string,
  topK: number,
): Promise<SearchResult[]> {
  const embeddingStr = `[${embedding.join(',')}]`;

  const results = (await db.execute(sql`
    SELECT c.content, c.document_id as "documentId",
           1 - (c.embedding <=> ${embeddingStr}::halfvec) as similarity
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    JOIN workspaces w ON d.workspace_id = w.id
    WHERE c.embedding IS NOT NULL
      AND w.owner_id = ${userId}::uuid
    ORDER BY c.embedding <=> ${embeddingStr}::halfvec
    LIMIT ${topK}
  `)) as unknown as SearchResult[];

  return results;
}

/**
 * 检查是否应该使用混合检索
 *
 * 适用场景：
 * - 查询包含专业术语
 * - 查询较短（< 20 字符）
 * - 需要精确关键词匹配
 */
export function shouldUseHybridSearch(query: string): boolean {
  // 如果查询很短，混合检索可能更好
  if (query.length < 20) return true;

  // 如果包含专业术语标记（引号、代码、命令等）
  if (/["'`]|\/|\\|\-\-/.test(query)) return true;

  // 如果包含英文单词（专业术语）
  if (/[a-zA-Z]{4,}/.test(query)) return true;

  return false;
}

/**
 * Reranker Validation Module
 *
 * 用于验证和评估 Reranking 效果：
 * - 对比 Reranking 前后的结果
 * - 计算评估指标（NDCG, MRR 等）
 * - 生成可视化对比报告
 */

import { env } from '@nexusnote/config';

// ============================================
// Types
// ============================================

interface RankingResult {
  content: string;
  relevanceScore: number;
  rank: number;
}

interface ComparisonResult {
  query: string;
  beforeReranking: RankingResult[];
  afterReranking: RankingResult[];
  metrics: {
    ndcg: number; // Normalized Discounted Cumulative Gain
    mrr: number; // Mean Reciprocal Rank
    precision: number; // Precision@K
  };
  improvements: {
    topResultChanged: boolean;
    avgRankImprovement: number;
    relevanceImprovement: number;
  };
}

// ============================================
// Evaluation Metrics
// ============================================

/**
 * Calculate NDCG (Normalized Discounted Cumulative Gain)
 *
 * NDCG 衡量排序质量，考虑位置和相关性
 * Formula: NDCG = DCG / IDCG
 * - DCG = Σ (rel_i / log2(i+1))
 * - IDCG = 完美排序的 DCG
 */
function calculateNDCG(results: RankingResult[], k: number = 5): number {
  if (results.length === 0) return 0;

  const relevances = results.slice(0, k).map(r => r.relevanceScore);

  // Calculate DCG
  const dcg = relevances.reduce((sum, rel, i) => {
    return sum + rel / Math.log2(i + 2); // i+2 because log2(1) = 0
  }, 0);

  // Calculate IDCG (ideal ranking)
  const idealRelevances = [...relevances].sort((a, b) => b - a);
  const idcg = idealRelevances.reduce((sum, rel, i) => {
    return sum + rel / Math.log2(i + 2);
  }, 0);

  return idcg === 0 ? 0 : dcg / idcg;
}

/**
 * Calculate MRR (Mean Reciprocal Rank)
 *
 * MRR 衡量第一个相关结果的排名
 * Formula: MRR = 1 / rank_of_first_relevant
 */
function calculateMRR(results: RankingResult[], threshold: number = 0.5): number {
  const firstRelevantIndex = results.findIndex(r => r.relevanceScore >= threshold);
  return firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1);
}

/**
 * Calculate Precision@K
 *
 * Precision@K 衡量前 K 个结果中相关结果的比例
 */
function calculatePrecision(results: RankingResult[], k: number = 5, threshold: number = 0.5): number {
  const topK = results.slice(0, k);
  const relevant = topK.filter(r => r.relevanceScore >= threshold).length;
  return relevant / k;
}

// ============================================
// Reranking Comparison
// ============================================

/**
 * 对比 Reranking 前后的效果
 */
export function compareRankings(
  query: string,
  beforeReranking: Array<{ content: string; similarity: number }>,
  afterReranking: Array<{ content: string; similarity: number }>,
): ComparisonResult {
  // 转换为统一格式
  const before: RankingResult[] = beforeReranking.map((r, i) => ({
    content: r.content,
    relevanceScore: r.similarity,
    rank: i + 1,
  }));

  const after: RankingResult[] = afterReranking.map((r, i) => ({
    content: r.content,
    relevanceScore: r.similarity,
    rank: i + 1,
  }));

  // 计算指标
  const metrics = {
    ndcg: calculateNDCG(after, 5),
    mrr: calculateMRR(after, 0.5),
    precision: calculatePrecision(after, 5, 0.5),
  };

  // 分析改进
  const topResultChanged = before[0]?.content !== after[0]?.content;

  // 计算平均排名改进
  const beforeMap = new Map(before.map(r => [r.content.slice(0, 50), r.rank]));
  const avgRankImprovement = after.reduce((sum, r) => {
    const key = r.content.slice(0, 50);
    const beforeRank = beforeMap.get(key);
    if (beforeRank) {
      return sum + (beforeRank - r.rank); // 正数表示排名提升
    }
    return sum;
  }, 0) / after.length;

  // 计算相关性改进
  const avgRelevanceBefore = before.reduce((sum, r) => sum + r.relevanceScore, 0) / before.length;
  const avgRelevanceAfter = after.reduce((sum, r) => sum + r.relevanceScore, 0) / after.length;
  const relevanceImprovement = ((avgRelevanceAfter - avgRelevanceBefore) / avgRelevanceBefore) * 100;

  return {
    query,
    beforeReranking: before,
    afterReranking: after,
    metrics,
    improvements: {
      topResultChanged,
      avgRankImprovement,
      relevanceImprovement,
    },
  };
}

// ============================================
// Validation Report
// ============================================

/**
 * 生成 Reranking 验证报告
 */
export function generateValidationReport(comparison: ComparisonResult): string {
  const { query, beforeReranking, afterReranking, metrics, improvements } = comparison;

  let report = `
# Reranker Validation Report

## Query
"${query}"

## Metrics
- **NDCG@5**: ${metrics.ndcg.toFixed(3)} (1.0 = perfect ranking)
- **MRR**: ${metrics.mrr.toFixed(3)} (higher is better)
- **Precision@5**: ${(metrics.precision * 100).toFixed(1)}%

## Improvements
- **Top Result Changed**: ${improvements.topResultChanged ? '✅ Yes' : '❌ No'}
- **Avg Rank Improvement**: ${improvements.avgRankImprovement > 0 ? '📈' : '📉'} ${improvements.avgRankImprovement.toFixed(2)} positions
- **Relevance Improvement**: ${improvements.relevanceImprovement > 0 ? '📈' : '📉'} ${improvements.relevanceImprovement.toFixed(1)}%

## Before Reranking (Top 5)
${beforeReranking.slice(0, 5).map((r, i) => `${i + 1}. [${r.relevanceScore.toFixed(3)}] ${r.content.slice(0, 80)}...`).join('\n')}

## After Reranking (Top 5)
${afterReranking.slice(0, 5).map((r, i) => {
  const emoji = i < 3 ? '🥇🥈🥉'[i] : '🏅';
  return `${emoji} ${i + 1}. [${r.relevanceScore.toFixed(3)}] ${r.content.slice(0, 80)}...`;
}).join('\n')}

## Conclusion
${getConclusion(metrics, improvements)}
`;

  return report.trim();
}

function getConclusion(
  metrics: ComparisonResult['metrics'],
  improvements: ComparisonResult['improvements'],
): string {
  const { ndcg, mrr, precision } = metrics;
  const { topResultChanged, avgRankImprovement, relevanceImprovement } = improvements;

  const conclusions: string[] = [];

  // NDCG 分析
  if (ndcg > 0.9) {
    conclusions.push('✅ Excellent ranking quality (NDCG > 0.9)');
  } else if (ndcg > 0.7) {
    conclusions.push('✅ Good ranking quality (NDCG > 0.7)');
  } else if (ndcg > 0.5) {
    conclusions.push('⚠️ Moderate ranking quality (NDCG > 0.5)');
  } else {
    conclusions.push('❌ Poor ranking quality (NDCG < 0.5)');
  }

  // MRR 分析
  if (mrr === 1.0) {
    conclusions.push('✅ Most relevant result is ranked #1');
  } else if (mrr > 0.5) {
    conclusions.push('✅ Relevant result in top 2');
  } else if (mrr > 0) {
    conclusions.push('⚠️ Relevant result found, but not at top');
  } else {
    conclusions.push('❌ No highly relevant results found');
  }

  // Precision 分析
  if (precision >= 0.8) {
    conclusions.push(`✅ High precision: ${(precision * 100).toFixed(0)}% of top 5 are relevant`);
  } else if (precision >= 0.6) {
    conclusions.push(`✅ Good precision: ${(precision * 100).toFixed(0)}% of top 5 are relevant`);
  } else {
    conclusions.push(`⚠️ Low precision: only ${(precision * 100).toFixed(0)}% of top 5 are relevant`);
  }

  // 改进分析
  if (avgRankImprovement > 0.5) {
    conclusions.push(`✅ Reranking significantly improved ranking (+${avgRankImprovement.toFixed(1)} positions on average)`);
  } else if (avgRankImprovement < -0.5) {
    conclusions.push(`❌ Reranking worsened ranking (${avgRankImprovement.toFixed(1)} positions on average)`);
  } else {
    conclusions.push('ℹ️ Reranking had minimal impact on ranking');
  }

  // 总结
  const goodIndicators = conclusions.filter(c => c.startsWith('✅')).length;
  const badIndicators = conclusions.filter(c => c.startsWith('❌')).length;

  if (goodIndicators >= 3 && badIndicators === 0) {
    conclusions.push('\n**Overall: Reranker is working effectively! 🎉**');
  } else if (badIndicators > 0) {
    conclusions.push('\n**Overall: Reranker may need tuning or is not helping. Consider disabling it.**');
  } else {
    conclusions.push('\n**Overall: Reranker is working, but there is room for improvement.**');
  }

  return conclusions.join('\n');
}

// ============================================
// Test Queries
// ============================================

/**
 * 标准测试查询集
 */
export const testQueries = [
  {
    query: 'NexusNote 如何收费',
    expectedKeywords: ['价格', '定价', '收费', '免费', '付费'],
  },
  {
    query: 'RAG 是什么',
    expectedKeywords: ['RAG', '检索增强生成', 'Retrieval', 'Augmented'],
  },
  {
    query: '如何使用 AI 助手',
    expectedKeywords: ['AI', '助手', '使用', '操作', '教程'],
  },
];

// ============================================
// Logging Helper
// ============================================

/**
 * 记录 Reranking 统计信息
 */
export function logRerankingStats(
  before: Array<{ content: string; similarity: number }>,
  after: Array<{ content: string; similarity: number }>,
): void {
  if (!env.RERANKER_ENABLED) {
    console.log('[Reranker] ❌ DISABLED - No reranking performed');
    return;
  }

  const topResultChanged = before[0]?.content !== after[0]?.content;
  const avgScoreBefore = before.reduce((sum, r) => sum + r.similarity, 0) / before.length;
  const avgScoreAfter = after.reduce((sum, r) => sum + r.similarity, 0) / after.length;

  console.log('[Reranker] Stats:');
  console.log(`  - Top result changed: ${topResultChanged ? '✅ Yes' : '❌ No'}`);
  console.log(`  - Avg score before: ${avgScoreBefore.toFixed(3)}`);
  console.log(`  - Avg score after: ${avgScoreAfter.toFixed(3)}`);
  console.log(`  - Score improvement: ${((avgScoreAfter - avgScoreBefore) * 100).toFixed(1)}%`);
}

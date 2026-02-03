/**
 * Context Compression Module
 *
 * 压缩 RAG 检索结果，只保留最相关的片段：
 * - 提取关键句子
 * - 移除冗余内容
 * - 减少 LLM 输入 tokens（节省成本和延迟）
 */

import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '@nexusnote/config';
import { z } from 'zod';

// ============================================
// AI Model Configuration
// ============================================

const openai = env.AI_302_API_KEY
  ? createOpenAI({
      baseURL: 'https://api.302.ai/v1',
      apiKey: env.AI_302_API_KEY,
    })
  : null;

const fastModel = openai ? openai(env.AI_FAST_MODEL || 'gemini-3-flash-preview') : null;

// ============================================
// Context Compression Schema
// ============================================

const CompressionSchema = z.object({
  compressedChunks: z.array(
    z.object({
      originalIndex: z.number().describe('原文档索引'),
      relevantContent: z.string().describe('提取的相关内容'),
      relevanceScore: z.number().min(0).max(1).describe('相关性评分'),
    })
  ),
  totalReduction: z.number().describe('压缩率（0-1）'),
});

type CompressionResult = z.infer<typeof CompressionSchema>;

// ============================================
// Extraction-based Compression (Fast, Rule-based)
// ============================================

/**
 * 基于规则的快速压缩（不依赖 LLM）
 *
 * 策略：
 * 1. 句子分割
 * 2. 计算句子与查询的相关性（关键词匹配）
 * 3. 保留 Top-N 相关句子
 */
export function extractRelevantSentences(
  text: string,
  query: string,
  maxSentences: number = 5,
): string {
  // 句子分割（支持中英文）
  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // 过滤短句

  if (sentences.length <= maxSentences) {
    return text; // 无需压缩
  }

  // 提取查询关键词（简单分词）
  const queryKeywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  // 计算每个句子的相关性评分
  const scoredSentences = sentences.map(sentence => {
    const lowerSentence = sentence.toLowerCase();
    const score = queryKeywords.reduce((sum, keyword) => {
      return sum + (lowerSentence.includes(keyword) ? 1 : 0);
    }, 0);
    return { sentence, score };
  });

  // 排序并取 Top-N
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(s => s.sentence);

  return topSentences.join(' ');
}

// ============================================
// LLM-based Compression (Slow, High-quality)
// ============================================

/**
 * 使用 LLM 进行智能压缩
 *
 * 优势：
 * - 理解语义，而非简单关键词匹配
 * - 可以改写和总结
 * - 更高的压缩质量
 *
 * 劣势：
 * - 需要额外的 LLM 调用
 * - 增加延迟和成本
 */
export async function compressWithLLM(
  query: string,
  documents: Array<{ content: string; index: number }>,
  targetTokens: number = 500,
): Promise<CompressionResult | null> {
  if (!fastModel || documents.length === 0) {
    return null;
  }

  try {
    const result = await generateText({
      model: fastModel,
      output: Output.object({
        schema: CompressionSchema,
      }),
      prompt: `你是一个文档压缩专家。你的任务是从检索结果中提取与用户查询最相关的内容。

## 用户查询
"${query}"

## 检索到的文档（共 ${documents.length} 个）
${documents.map((d, i) => `[${i}] ${d.content.slice(0, 200)}...`).join('\n\n')}

## 压缩目标
- 目标长度：约 ${targetTokens} tokens
- 只保留与查询直接相关的内容
- 移除冗余和无关信息
- 保持原意，不添加新信息

## 输出要求
返回压缩后的文档片段列表，每个片段包含：
1. originalIndex - 原文档索引
2. relevantContent - 提取的相关内容（完整句子，不截断）
3. relevanceScore - 相关性评分（0-1）

请确保压缩后的内容总长度接近目标长度。`,
      temperature: 0.1, // 低温度，保持一致性
      maxRetries: 2,
    });

    return result.experimental_output as CompressionResult;
  } catch (err) {
    console.error('[Context Compressor] LLM compression failed:', err);
    return null;
  }
}

// ============================================
// Hybrid Compression Strategy
// ============================================

export interface CompressionOptions {
  /** 压缩策略：'fast' 基于规则，'llm' 使用 LLM，'auto' 自动选择 */
  strategy?: 'fast' | 'llm' | 'auto';
  /** 目标 token 数量（仅用于 LLM 策略） */
  targetTokens?: number;
  /** 最大句子数（仅用于 fast 策略） */
  maxSentences?: number;
}

/**
 * 压缩检索上下文
 */
export async function compressContext(
  query: string,
  documents: Array<{ content: string; documentId: string; similarity: number }>,
  options: CompressionOptions = {},
): Promise<Array<{ content: string; documentId: string; similarity: number }>> {
  const { strategy = 'auto', targetTokens = 500, maxSentences = 5 } = options;

  if (documents.length === 0) {
    return documents;
  }

  // 自动选择策略：如果文档少或内容短，使用 fast；否则考虑 LLM
  let effectiveStrategy = strategy;
  if (strategy === 'auto') {
    const totalLength = documents.reduce((sum, d) => sum + d.content.length, 0);
    effectiveStrategy = totalLength > 2000 && documents.length > 3 ? 'llm' : 'fast';
  }

  // Fast 策略：基于规则的句子提取
  if (effectiveStrategy === 'fast') {
    console.log('[Context Compressor] Using fast rule-based compression');
    return documents.map(doc => ({
      ...doc,
      content: extractRelevantSentences(doc.content, query, maxSentences),
    }));
  }

  // LLM 策略：智能压缩
  if (effectiveStrategy === 'llm') {
    console.log('[Context Compressor] Using LLM-based compression');
    const indexedDocs = documents.map((d, i) => ({ content: d.content, index: i }));
    const compressionResult = await compressWithLLM(query, indexedDocs, targetTokens);

    if (!compressionResult) {
      // Fallback to fast strategy
      console.warn('[Context Compressor] LLM failed, falling back to fast strategy');
      return documents.map(doc => ({
        ...doc,
        content: extractRelevantSentences(doc.content, query, maxSentences),
      }));
    }

    // 重建压缩后的文档列表
    const compressed = compressionResult.compressedChunks.map(chunk => ({
      ...documents[chunk.originalIndex],
      content: chunk.relevantContent,
      similarity: chunk.relevanceScore, // 更新相关性评分
    }));

    console.log(
      `[Context Compressor] Reduced from ${documents.length} to ${compressed.length} chunks (${(compressionResult.totalReduction * 100).toFixed(1)}% reduction)`
    );

    return compressed;
  }

  return documents;
}

/**
 * 简单的 token 估算（1 token ≈ 4 字符）
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 检查是否需要压缩
 */
export function shouldCompress(documents: Array<{ content: string }>, maxTokens: number = 1000): boolean {
  const totalTokens = documents.reduce((sum, d) => sum + estimateTokens(d.content), 0);
  return totalTokens > maxTokens;
}

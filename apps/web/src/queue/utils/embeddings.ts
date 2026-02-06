/**
 * Embeddings Utility
 *
 * 调用远程 embedding API 生成文本向量
 * 支持两种方式：
 * 1. 直接 API 调用（当前生产使用）
 * 2. AI SDK v6 embedMany（推荐）
 */

import { env } from '@nexusnote/config';
import { embedMany } from 'ai';

export interface EmbeddingResponse {
  embedding: number[];
  index: number;
}

/**
 * 使用 AI SDK v6 embedMany 生成嵌入（推荐方式）
 *
 * 优势：
 * - 内置并行处理（maxParallelCalls）
 * - 更好的错误处理
 * - 支持 Langfuse 自动追踪
 * - 官方推荐的标准方式
 *
 * @param texts 文本数组
 * @param model 嵌入模型（来自 AI SDK）
 * @returns 嵌入向量数组
 */
export async function generateEmbeddingsWithSDK(
  texts: string[],
  model: any,  // 来自 AI SDK 的语言模型
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  console.log(`[Embeddings] Generating ${texts.length} embeddings with AI SDK...`);

  try {
    const { embeddings } = await embedMany({
      model,
      values: texts,
      maxParallelCalls: 5,  // 最多5个并行请求
    });

    console.log(`[Embeddings] ✅ Generated ${embeddings.length} embeddings (AI SDK)`);
    return embeddings;
  } catch (err) {
    console.error('[Embeddings] ❌ Error generating embeddings with AI SDK:', err);
    throw err;
  }
}

/**
 * 生成文本嵌入
 * 调用配置的 embedding 服务
 *
 * @param texts 文本数组
 * @returns 嵌入向量数组
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  console.log(`[Embeddings] Generating ${texts.length} embeddings...`);

  try {
    // 调用 embedding API
    // 这里假设使用兼容 OpenAI 格式的 API
    const apiUrl = env.AI_302_API_KEY
      ? `${env.SILICONFLOW_API_KEY ? 'https://api.siliconflow.cn/v1' : 'https://api.302.ai/v1'}`
      : 'http://localhost:8000/v1'; // 本地 Ollama 等

    const response = await fetch(`${apiUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.SILICONFLOW_API_KEY && {
          Authorization: `Bearer ${env.SILICONFLOW_API_KEY}`,
        }),
        ...(env.AI_302_API_KEY && {
          Authorization: `Bearer ${env.AI_302_API_KEY}`,
        }),
      },
      body: JSON.stringify({
        model: env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-8B',
        input: texts,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Embedding API error: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();

    // 排序响应数据以确保顺序正确
    const sortedData = data.data.sort(
      (a: EmbeddingResponse, b: EmbeddingResponse) => a.index - b.index,
    );

    const embeddings = sortedData.map((item: EmbeddingResponse) => item.embedding);

    console.log(`[Embeddings] ✅ Generated ${embeddings.length} embeddings`);

    return embeddings;
  } catch (err) {
    console.error('[Embeddings] ❌ Error generating embeddings:', err);

    // 返回 null 向量以继续处理，但不存储向量
    return texts.map(() => null);
  }
}

/**
 * 生成单个文本的嵌入
 */
export async function generateSingleEmbedding(text: string): Promise<number[] | null> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0] || null;
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

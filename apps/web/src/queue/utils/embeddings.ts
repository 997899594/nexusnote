/**
 * Embeddings Utility
 *
 * 调用远程 embedding API 生成文本向量
 * 支持两种方式：
 * 1. 直接 API 调用（当前生产使用）
 * 2. AI SDK v6 embedMany（推荐）
 */

import { env } from "@nexusnote/config";
import { embedMany, type EmbeddingModel } from "ai";

export interface EmbeddingResponse {
  embedding: number[];
  index: number;
}

/**
 * 生成文本嵌入
 * 使用 AI SDK v6 embedMany（推荐方式）
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
export async function generateEmbeddings(
  texts: string[],
  model: EmbeddingModel, // 2026 架构师标准：使用强类型
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  console.log(
    `[Embeddings] Generating ${texts.length} embeddings with AI SDK...`,
  );

  try {
    const { embeddings } = await embedMany({
      model,
      values: texts,
      maxParallelCalls: 5, // 最多5个并行请求
    });

    console.log(
      `[Embeddings] ✅ Generated ${embeddings.length} embeddings (AI SDK)`,
    );
    return embeddings;
  } catch (err) {
    console.error(
      "[Embeddings] ❌ Error generating embeddings with AI SDK:",
      err,
    );
    throw err;
  }
}

/**
 * 生成单个文本的嵌入
 */
export async function generateSingleEmbedding(
  text: string,
  model: EmbeddingModel,
): Promise<number[] | null> {
  const embeddings = await generateEmbeddings([text], model);
  return embeddings[0] || null;
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
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

/**
 * Semantic Chunker - 语义分块
 *
 * 用于聊天内容的智能分块，基于语义相似度确定分块边界
 * 原理：计算相邻句子/轮次的语义距离，距离大 = 主题变化 = 新分块
 */

import { embedMany } from "ai";
import { aiProvider } from "../provider";
import { cosineSimilarity } from "./utils/cosine-similarity";

export interface SemanticChunk {
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface SemanticChunkOptions {
  similarityThreshold?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
}

const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const DEFAULT_MIN_CHUNK_SIZE = 100;
const DEFAULT_MAX_CHUNK_SIZE = 1000;

/**
 * 将文本按句子分割
 */
function splitIntoSentences(text: string): string[] {
  const sentences = text
    .split(/[。！？!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences;
}

/**
 * 将聊天消息转换为可分块的文本段落
 * 每个段落 = 一轮对话（用户 + AI）
 */
export function conversationToParagraphs(
  messages: Array<{ role: string; content: string }>,
): string[] {
  const paragraphs: string[] = [];
  let currentParagraph = "";

  for (const msg of messages) {
    const prefix = msg.role === "user" ? "用户: " : "AI: ";
    const text = `${prefix}${msg.content.trim()}`;

    if (msg.role === "user" && currentParagraph) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = text;
    } else {
      currentParagraph += (currentParagraph ? "\n" : "") + text;
    }
  }

  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim());
  }

  return paragraphs;
}

/**
 * 语义分块 - 基于嵌入相似度
 */
export async function semanticChunk(
  text: string,
  options: SemanticChunkOptions = {},
): Promise<SemanticChunk[]> {
  const {
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    minChunkSize = DEFAULT_MIN_CHUNK_SIZE,
    maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  if (!aiProvider.isConfigured()) {
    console.warn(
      "[SemanticChunker] Embedding model not configured, falling back to fixed-size chunking",
    );
    return fallbackChunk(text, minChunkSize);
  }

  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    return [];
  }

  if (sentences.length === 1) {
    return [{ content: sentences[0], startIndex: 0, endIndex: 0 }];
  }

  try {
    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: sentences,
    });

    const chunks: SemanticChunk[] = [];
    let currentChunk: string[] = [sentences[0]];
    let currentStart = 0;

    for (let i = 1; i < sentences.length; i++) {
      const prevEmbedding = embeddings[i - 1];
      const currEmbedding = embeddings[i];

      if (!prevEmbedding || !currEmbedding) continue;

      const similarity = cosineSimilarity(prevEmbedding, currEmbedding);
      const currentLength = currentChunk.join("。").length;

      const shouldBreak = similarity < similarityThreshold || currentLength >= maxChunkSize;

      if (shouldBreak && currentLength >= minChunkSize) {
        chunks.push({
          content: currentChunk.join("。"),
          startIndex: currentStart,
          endIndex: i - 1,
        });
        currentChunk = [sentences[i]];
        currentStart = i;
      } else {
        currentChunk.push(sentences[i]);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join("。"),
        startIndex: currentStart,
        endIndex: sentences.length - 1,
      });
    }

    console.log(
      `[SemanticChunker] Created ${chunks.length} semantic chunks from ${sentences.length} sentences`,
    );
    return chunks;
  } catch (error) {
    console.error("[SemanticChunker] Error during semantic chunking:", error);
    return fallbackChunk(text, minChunkSize);
  }
}

/**
 * 后备方案：固定大小分块
 */
function fallbackChunk(text: string, chunkSize: number): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        startIndex: chunkIndex,
        endIndex: chunkIndex,
      });
      chunkIndex++;
    }

    start = end;
  }

  return chunks;
}

/**
 * 将聊天消息语义分块
 */
export async function semanticChunkConversation(
  messages: Array<{ role: string; content: string }>,
  options: SemanticChunkOptions = {},
): Promise<SemanticChunk[]> {
  const paragraphs = conversationToParagraphs(messages);
  const text = paragraphs.join("\n\n");
  return semanticChunk(text, options);
}

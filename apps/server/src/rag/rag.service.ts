import { Injectable, OnModuleInit } from '@nestjs/common'
import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { eq, sql } from 'drizzle-orm'
import { createOpenAI } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'
import { documents, documentChunks } from '@nexusnote/db'
import type { RagIndexJob } from '@nexusnote/types'
import { db } from '../database/database.module'
import { env, config } from '../config/env.config'

// ============================================
// AI SDK 6.x Embedding Provider
// ============================================
const openai = env.AI_302_API_KEY
  ? createOpenAI({
      baseURL: 'https://api.302.ai/v1',
      apiKey: env.AI_302_API_KEY,
    })
  : null

const embeddingModel = openai ? openai.embedding(env.EMBEDDING_MODEL) : null

// ============================================
// Retry Utility
// ============================================
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number; name: string }
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < options.retries) {
        const backoffDelay = options.delay * Math.pow(2, attempt)
        console.warn(`[${options.name}] Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms:`, lastError.message)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }
  }

  throw lastError
}

// ============================================
// Embedding Functions with Retry
// ============================================
async function embedText(text: string): Promise<number[]> {
  if (!embeddingModel) {
    console.warn('[RAG] No embedding model configured')
    return []
  }

  return withRetry(
    async () => {
      const { embedding } = await embed({
        model: embeddingModel,
        value: text,
      })
      // MRL truncation: Qwen3 supports Matryoshka, first N dimensions retain semantic integrity
      return embedding.slice(0, config.embedding.dimensions)
    },
    {
      retries: config.rag.retries,
      delay: config.queue.ragBackoffDelay,
      name: 'Embed',
    }
  )
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!embeddingModel) {
    console.warn('[RAG] No embedding model configured')
    return texts.map(() => [])
  }

  return withRetry(
    async () => {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: texts,
      })
      // MRL truncation
      return embeddings.map(e => e.slice(0, config.embedding.dimensions))
    },
    {
      retries: config.rag.retries,
      delay: config.queue.ragBackoffDelay,
      name: 'EmbedMany',
    }
  )
}

// ============================================
// Reranker - Two-stage reranking
// ============================================
interface RerankResult {
  index: number
  relevance_score: number
}

async function rerank(
  query: string,
  documents: string[],
  topN = 5
): Promise<RerankResult[]> {
  if (!config.reranker.enabled || !env.AI_302_API_KEY) {
    // Fallback: simple score decay
    return documents.map((_, i) => ({
      index: i,
      relevance_score: 1 - i * 0.1,
    }))
  }

  try {
    const response = await withRetry(
      async () => {
        const res = await fetch('https://api.302.ai/v1/rerank', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AI_302_API_KEY}`,
          },
          body: JSON.stringify({
            model: config.reranker.model,
            query,
            documents,
            top_n: topN,
          }),
        })

        if (!res.ok) {
          const err = await res.text()
          throw new Error(`Reranker HTTP ${res.status}: ${err}`)
        }

        return res
      },
      {
        retries: config.rag.retries,
        delay: config.queue.ragBackoffDelay,
        name: 'Reranker',
      }
    )

    const data = await response.json()
    return data.results || data.data || []
  } catch (err) {
    console.error('[Reranker] Failed after retries:', err)
    // Fallback on complete failure
    return documents.map((_, i) => ({
      index: i,
      relevance_score: 1 - i * 0.1,
    }))
  }
}

// ============================================
// Smart Text Chunking
// ============================================
function splitIntoChunks(text: string): string[] {
  const { chunkSize, chunkOverlap } = config.rag
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      const sentences = paragraph.split(/(?<=[.!?。！？])\s+/)
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize) {
          if (currentChunk) chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          currentChunk += ' ' + sentence
        }
      }
    } else if (currentChunk.length + paragraph.length > chunkSize) {
      chunks.push(currentChunk.trim())
      currentChunk = currentChunk.slice(-chunkOverlap) + ' ' + paragraph
    } else {
      currentChunk += '\n\n' + paragraph
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim())
  return chunks.filter(c => c.length > 20)
}

// ============================================
// Content Hash for Idempotency
// ============================================
function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

// ============================================
// RAG Service - AI SDK 6.x
// ============================================
@Injectable()
export class RagService implements OnModuleInit {
  private worker: Worker | null = null
  private processingDocs = new Set<string>() // Prevent duplicate processing

  async onModuleInit() {
    console.log('[RAG] 2026 Architecture - AI SDK 6.x')
    console.log(`[RAG] Model: ${config.embedding.model}`)
    console.log(`[RAG] Dimensions: ${config.embedding.dimensions}`)
    console.log(`[RAG] Chunk Size: ${config.rag.chunkSize}`)
    console.log(`[RAG] Retries: ${config.rag.retries}`)
    console.log(`[RAG] Reranker: ${config.reranker.enabled ? config.reranker.model : 'disabled'}`)
    await this.startWorker()
  }

  private async startWorker() {
    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

    this.worker = new Worker<RagIndexJob>(
      'rag-index',
      async (job: Job<RagIndexJob>) => {
        const { documentId, content: plainText } = job.data

        // Idempotency check: skip if already processing
        if (this.processingDocs.has(documentId)) {
          console.log(`[RAG] Skipping duplicate: ${documentId}`)
          return
        }

        this.processingDocs.add(documentId)
        try {
          console.log(`[RAG] Processing: ${documentId}`)
          await this.indexDocument(documentId, plainText)
        } catch (err) {
          console.error(`[RAG] Failed: ${documentId}`, err)
          throw err
        } finally {
          this.processingDocs.delete(documentId)
        }
      },
      {
        connection: connection as any,
        concurrency: config.queue.ragConcurrency,
      }
    )

    this.worker.on('completed', job => console.log(`[RAG] Done: ${job.id}`))
    this.worker.on('failed', (job, err) =>
      console.error(`[RAG] Job failed: ${job?.id}`, err.message)
    )
    console.log('[RAG Worker] Started')
  }

  async indexDocument(documentId: string, plainText: string) {
    if (!plainText || plainText.trim().length < 20) return

    const chunks = splitIntoChunks(plainText)
    if (chunks.length === 0) return

    // Content hash for idempotency
    const contentHash = hashContent(plainText)

    // Check if content unchanged (simple check via chunk count)
    const existingChunks = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .limit(1)

    // If same number of chunks exist, skip (basic idempotency)
    // In production, store contentHash in documents table for proper check
    if (existingChunks.length > 0) {
      console.log(`[RAG] Re-indexing: ${documentId} (${chunks.length} chunks)`)
    }

    console.log(`[RAG] Indexing ${chunks.length} chunks with AI SDK 6.x`)

    // Use AI SDK embedMany with retry
    const embeddings = await embedTexts(chunks)
    if (embeddings[0]?.length === 0) {
      console.log('[RAG] Skipped (no embedding model)')
      return
    }

    // Delete old chunks
    await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId))

    // Insert new chunks in batches
    const values = chunks.map((content, i) => ({
      documentId,
      content,
      embedding: embeddings[i],
      chunkIndex: i,
    }))

    const batchSize = 50
    for (let i = 0; i < values.length; i += batchSize) {
      await db.insert(documentChunks).values(values.slice(i, i + batchSize))
    }

    console.log(`[RAG] Indexed: ${documentId} (hash: ${contentHash})`)
  }

  async retrieve(
    query: string,
    topK = config.rag.topK
  ): Promise<Array<{ content: string; documentId: string; similarity: number }>> {
    // Step 1: Vector retrieval (recall more candidates for reranker)
    const embedding = await embedText(query)
    if (embedding.length === 0) return []

    const embeddingStr = `[${embedding.join(',')}]`
    const candidateCount = config.reranker.enabled ? topK * 4 : topK

    const candidates = (await db.execute(sql`
      SELECT content, document_id as "documentId",
             1 - (embedding <=> ${embeddingStr}::halfvec) as similarity
      FROM document_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::halfvec
      LIMIT ${candidateCount}
    `)) as unknown as Array<{
      content: string
      documentId: string
      similarity: number
    }>

    if (candidates.length === 0) return []

    // Step 2: Reranker reordering
    if (config.reranker.enabled && candidates.length > 1) {
      console.log(`[RAG] Reranking ${candidates.length} candidates with ${config.reranker.model}`)
      const rerankResults = await rerank(
        query,
        candidates.map(c => c.content),
        topK
      )

      const reranked = rerankResults
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, topK)
        .map(r => ({
          ...candidates[r.index],
          similarity: r.relevance_score,
        }))

      return reranked
    }

    return candidates.slice(0, topK)
  }

  async getDocumentTitle(documentId: string): Promise<string> {
    const result = await db
      .select({ title: documents.title })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)
    return result[0]?.title || 'Untitled'
  }

  async getOutdatedDocuments(): Promise<string[]> {
    const results = await db
      .selectDistinct({ documentId: documentChunks.documentId })
      .from(documentChunks)
      .limit(100)
    return results.map(r => r.documentId).filter(Boolean) as string[]
  }
}

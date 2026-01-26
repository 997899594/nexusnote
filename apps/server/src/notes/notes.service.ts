import { Injectable, OnModuleInit } from '@nestjs/common'
import { Worker, Job, Queue } from 'bullmq'
import IORedis from 'ioredis'
import { eq, sql } from 'drizzle-orm'
import { createOpenAI } from '@ai-sdk/openai'
import { embed, generateText } from 'ai'
import { topics, extractedNotes, documents, learningChapters } from '@nexusnote/db'
import { db } from '../database/database.module'
import { env, config } from '../config/env.config'

// ============================================
// Types
// ============================================
export interface NoteClassifyJob {
  noteId: string
  content: string
  userId: string
}

export interface CreateNoteDto {
  content: string
  userId: string
  sourceType: 'document' | 'learning'
  sourceDocumentId?: string
  sourceChapterId?: string
  sourcePosition?: { from: number; to: number }
}

export interface TopicWithNotes {
  id: string
  name: string
  noteCount: number
  lastActiveAt: Date | null
  recentNotes?: Array<{ id: string; content: string }>
}

// ============================================
// AI Provider
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
// Embedding Function
// ============================================
async function embedText(text: string): Promise<number[]> {
  if (!embeddingModel) {
    console.warn('[Notes] No embedding model configured')
    return []
  }

  return withRetry(
    async () => {
      const { embedding } = await embed({
        model: embeddingModel,
        value: text,
      })
      return embedding.slice(0, config.embedding.dimensions)
    },
    {
      retries: config.rag.retries,
      delay: config.queue.ragBackoffDelay,
      name: 'NoteEmbed',
    }
  )
}

// ============================================
// Topic Name Generation
// ============================================
async function generateTopicName(content: string): Promise<string> {
  if (!openai) {
    // Fallback: use first few words
    return content.slice(0, 20).replace(/\s+/g, ' ').trim() + '...'
  }

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `基于这段笔记内容，生成一个简短的技术主题名称（不超过6个字，中文）：\n\n${content.slice(0, 500)}`,
      maxTokens: 20,
    })
    return text.trim().slice(0, 20)
  } catch (err) {
    console.error('[Notes] Failed to generate topic name:', err)
    return content.slice(0, 20).replace(/\s+/g, ' ').trim() + '...'
  }
}

// ============================================
// Notes Service
// ============================================
@Injectable()
export class NotesService implements OnModuleInit {
  private worker: Worker | null = null
  private queue: Queue | null = null
  private processingNotes = new Set<string>()

  // Similarity threshold for topic matching (cosine distance)
  // Lower = stricter matching, 0.25 is about 75% similarity
  private readonly TOPIC_THRESHOLD = 0.25

  async onModuleInit() {
    console.log('[Notes] Liquid Knowledge System - NexusNote 3.1')
    console.log(`[Notes] Topic threshold: ${this.TOPIC_THRESHOLD}`)
    await this.startWorker()
  }

  private async startWorker() {
    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

    // Create queue
    this.queue = new Queue('note-classify', { connection: connection as any })

    // Create worker
    this.worker = new Worker<NoteClassifyJob>(
      'note-classify',
      async (job: Job<NoteClassifyJob>) => {
        const { noteId, content, userId } = job.data

        // Idempotency check
        if (this.processingNotes.has(noteId)) {
          console.log(`[Notes] Skipping duplicate: ${noteId}`)
          return
        }

        this.processingNotes.add(noteId)
        try {
          console.log(`[Notes] Classifying: ${noteId}`)
          await this.classifyNote(noteId, content, userId)
        } catch (err) {
          console.error(`[Notes] Classification failed: ${noteId}`, err)
          throw err
        } finally {
          this.processingNotes.delete(noteId)
        }
      },
      {
        connection: connection as any,
        concurrency: 5,
      }
    )

    this.worker.on('completed', job => console.log(`[Notes] Classified: ${job.id}`))
    this.worker.on('failed', (job, err) =>
      console.error(`[Notes] Job failed: ${job?.id}`, err.message)
    )
    console.log('[Notes Worker] Started')
  }

  /**
   * Core classification logic
   */
  private async classifyNote(noteId: string, content: string, userId: string) {
    // Step 1: Generate embedding
    const embedding = await embedText(content)
    if (embedding.length === 0) {
      console.warn('[Notes] No embedding generated, marking as classified without topic')
      await db.update(extractedNotes)
        .set({ status: 'classified' })
        .where(eq(extractedNotes.id, noteId))
      return
    }

    // Step 2: Find nearest topic
    const nearestTopic = await this.findNearestTopic(userId, embedding)

    // Step 3: Decide: assign to existing topic or create new one
    let topicId: string

    if (nearestTopic && nearestTopic.distance < this.TOPIC_THRESHOLD) {
      // Assign to existing topic
      topicId = nearestTopic.id
      console.log(`[Notes] Matched topic: ${nearestTopic.name} (distance: ${nearestTopic.distance.toFixed(3)})`)
    } else {
      // Create new topic
      const topicName = await generateTopicName(content)
      const [newTopic] = await db.insert(topics).values({
        userId,
        name: topicName,
        embedding,
        noteCount: 1,
        lastActiveAt: new Date(),
      }).returning()
      topicId = newTopic.id
      console.log(`[Notes] Created topic: ${topicName}`)
    }

    // Step 4: Update note with embedding and topic (transaction)
    await db.transaction(async (tx) => {
      // Update note
      await tx.update(extractedNotes)
        .set({
          topicId,
          status: 'classified',
          embedding,
        })
        .where(eq(extractedNotes.id, noteId))

      // Increment topic count (only if existing topic)
      if (nearestTopic && nearestTopic.distance < this.TOPIC_THRESHOLD) {
        await tx.update(topics)
          .set({
            noteCount: sql`note_count + 1`,
            lastActiveAt: new Date(),
          })
          .where(eq(topics.id, topicId))
      }
    })
  }

  /**
   * Find the nearest topic for a given embedding
   */
  private async findNearestTopic(
    userId: string,
    embedding: number[]
  ): Promise<{ id: string; name: string; distance: number } | null> {
    const embeddingStr = `[${embedding.join(',')}]`

    const result = await db.execute(sql`
      SELECT id, name, embedding <=> ${embeddingStr}::halfvec AS distance
      FROM topics
      WHERE user_id = ${userId}
      ORDER BY distance
      LIMIT 1
    `) as unknown as Array<{ id: string; name: string; distance: number }>

    return result[0] ?? null
  }

  // ============================================
  // Public API Methods
  // ============================================

  /**
   * Create a new extracted note and queue for classification
   */
  async createNote(dto: CreateNoteDto): Promise<{ noteId: string }> {
    // Insert note with processing status
    const [note] = await db.insert(extractedNotes).values({
      userId: dto.userId,
      content: dto.content,
      sourceType: dto.sourceType,
      sourceDocumentId: dto.sourceDocumentId,
      sourceChapterId: dto.sourceChapterId,
      sourcePosition: dto.sourcePosition,
      status: 'processing',
    }).returning()

    // Queue classification job
    if (this.queue) {
      await this.queue.add('classify', {
        noteId: note.id,
        content: dto.content,
        userId: dto.userId,
      } as NoteClassifyJob, {
        jobId: `note-${note.id}`,
        removeOnComplete: true,
        removeOnFail: 100,
      })
      console.log(`[Notes] Queued classification: ${note.id}`)
    }

    return { noteId: note.id }
  }

  /**
   * Get all topics for a user with note counts
   */
  async getTopics(userId: string): Promise<TopicWithNotes[]> {
    const userTopics = await db
      .select({
        id: topics.id,
        name: topics.name,
        noteCount: topics.noteCount,
        lastActiveAt: topics.lastActiveAt,
      })
      .from(topics)
      .where(eq(topics.userId, userId))
      .orderBy(sql`last_active_at DESC NULLS LAST`)

    // Fetch recent notes for each topic (max 3)
    const topicsWithNotes = await Promise.all(
      userTopics.map(async (topic) => {
        const recentNotes = await db
          .select({
            id: extractedNotes.id,
            content: extractedNotes.content,
          })
          .from(extractedNotes)
          .where(eq(extractedNotes.topicId, topic.id))
          .orderBy(sql`created_at DESC`)
          .limit(3)

        return {
          ...topic,
          recentNotes,
        }
      })
    )

    return topicsWithNotes
  }

  /**
   * Get all notes for a specific topic
   */
  async getTopicNotes(topicId: string): Promise<Array<{
    id: string
    content: string
    sourceType: string
    sourceDocumentId: string | null
    sourceChapterId: string | null
    sourcePosition: unknown
    createdAt: Date | null
  }>> {
    return db
      .select({
        id: extractedNotes.id,
        content: extractedNotes.content,
        sourceType: extractedNotes.sourceType,
        sourceDocumentId: extractedNotes.sourceDocumentId,
        sourceChapterId: extractedNotes.sourceChapterId,
        sourcePosition: extractedNotes.sourcePosition,
        createdAt: extractedNotes.createdAt,
      })
      .from(extractedNotes)
      .where(eq(extractedNotes.topicId, topicId))
      .orderBy(sql`created_at DESC`)
  }

  /**
   * Get pending/processing notes for a user
   */
  async getPendingNotes(userId: string): Promise<Array<{
    id: string
    content: string
    status: string | null
  }>> {
    return db
      .select({
        id: extractedNotes.id,
        content: extractedNotes.content,
        status: extractedNotes.status,
      })
      .from(extractedNotes)
      .where(
        sql`${extractedNotes.userId} = ${userId} AND ${extractedNotes.status} = 'processing'`
      )
      .orderBy(sql`created_at DESC`)
  }
}

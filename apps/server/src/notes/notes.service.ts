import { Injectable, OnModuleInit } from '@nestjs/common'
import { Worker, Job, Queue } from 'bullmq'
import IORedis from 'ioredis'
import { eq, sql } from '@nexusnote/db'
import { embed, generateText } from 'ai'
import { topics, extractedNotes } from '@nexusnote/db'
import { db } from '../database/database.module'
import { env, defaults } from '@nexusnote/config'
import { getFastModel, getEmbeddingModel, AI_MODEL, isAIConfigured } from '../lib/ai'

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
  if (!isAIConfigured()) {
    console.warn('[Notes] No AI configured')
    return []
  }

  return withRetry(
    async () => {
      const { embedding } = await embed({
        model: getEmbeddingModel(),
        value: text,
      })
      return embedding.slice(0, defaults.embedding.dimensions)
    },
    {
      retries: defaults.rag.retries,
      delay: defaults.queue.ragBackoffDelay,
      name: 'NoteEmbed',
    }
  )
}

// ============================================
// Topic Name Generation
// ============================================
async function generateTopicName(content: string): Promise<string> {
  if (!isAIConfigured()) {
    return content.slice(0, 20).replace(/\s+/g, ' ').trim() + '...'
  }

  try {
    const { text } = await generateText({
      model: getFastModel(),
      prompt: `基于这段内容，生成一个简短的主题名称（不超过6个字，中文）：\n\n${content.slice(0, 500)}`,
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

  private readonly topicThreshold = env.NOTES_TOPIC_THRESHOLD || defaults.notes.topicThreshold

  async onModuleInit() {
    console.log('[Notes] Liquid Knowledge System - NexusNote 3.1')
    console.log(`[Notes] Topic threshold: ${this.topicThreshold}`)
    console.log(`[Notes] Model: ${AI_MODEL}`)
    await this.startWorker()
  }

  private async startWorker() {
    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

    this.queue = new Queue('note-classify', { connection: connection as any })

    this.worker = new Worker<NoteClassifyJob>(
      'note-classify',
      async (job: Job<NoteClassifyJob>) => {
        const { noteId, content, userId } = job.data

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

  private async classifyNote(noteId: string, content: string, userId: string) {
    const embedding = await embedText(content)
    if (embedding.length === 0) {
      console.warn('[Notes] No embedding generated, marking as classified without topic')
      await db.update(extractedNotes)
        .set({ status: 'classified' })
        .where(eq(extractedNotes.id, noteId))
      return
    }

    const nearestTopic = await this.findNearestTopic(userId, embedding)

    let topicId: string

    if (nearestTopic && nearestTopic.distance < this.topicThreshold) {
      topicId = nearestTopic.id
      console.log(`[Notes] Matched topic: ${nearestTopic.name} (distance: ${nearestTopic.distance.toFixed(3)})`)
    } else {
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

    await db.transaction(async (tx) => {
      await tx.update(extractedNotes)
        .set({
          topicId,
          status: 'classified',
          embedding,
        })
        .where(eq(extractedNotes.id, noteId))

      if (nearestTopic && nearestTopic.distance < this.topicThreshold) {
        await tx.update(topics)
          .set({
            noteCount: sql`note_count + 1`,
            lastActiveAt: new Date(),
          })
          .where(eq(topics.id, topicId))
      }
    })
  }

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

  async createNote(dto: CreateNoteDto): Promise<{ noteId: string }> {
    const [note] = await db.insert(extractedNotes).values({
      userId: dto.userId,
      content: dto.content,
      sourceType: dto.sourceType,
      sourceDocumentId: dto.sourceDocumentId,
      sourceChapterId: dto.sourceChapterId,
      sourcePosition: dto.sourcePosition,
      status: 'processing',
    }).returning()

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
          noteCount: topic.noteCount ?? 0,
          recentNotes,
        }
      })
    )

    return topicsWithNotes
  }

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

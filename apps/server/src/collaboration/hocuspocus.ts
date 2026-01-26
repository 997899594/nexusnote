import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { Redis } from '@hocuspocus/extension-redis'
import { eq } from 'drizzle-orm'
import * as Y from 'yjs'
import IORedis from 'ioredis'
import { addRagIndexJob } from '../queue/queue.module'
import { documents } from '@nexusnote/db'
import { db } from '../database/database.module'
import { env } from '../config/env.config'
import { AuthService } from '../auth/auth.service'

// Auth service instance for JWT verification
const authService = new AuthService()

// Redis client for distributed locking
// Connection established once to be reused
const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

/**
 * Distributed Debouncer using Redis
 * 
 * Ensures that even with multiple server instances, we only queue 
 * one RAG index job per document every 10 seconds.
 */
async function debouncedIndexDocument(documentName: string, plainText: string) {
  const lockKey = `lock:rag-index:${documentName}`

  // Try to acquire a 10-second lock
  // SET with NX (Only if not exists) and EX (Expires in seconds)
  const acquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX')

  if (!acquired) {
    // Already locked / recently indexed by this or another instance
    return
  }

  console.log(`[Hocuspocus] Lock acquired, queueing RAG index for: ${documentName}`)

  try {
    // 1. Update plain text in DB
    await db.update(documents)
      .set({ plainText, updatedAt: new Date() })
      .where(eq(documents.id, documentName))

    // 2. Queue the heavy indexing job
    await addRagIndexJob({ documentId: documentName, plainText })
  } catch (err) {
    console.error(`[Hocuspocus] Failed to queue RAG index:`, err)
    // On failure, we could potentially delete the lock to allow retry
  }
}

// 从 Yjs Doc 提取纯文本（服务器端，无 DOM）
function extractPlainText(ydoc: Y.Doc): string {
  try {
    const fragment = ydoc.getXmlFragment('default')
    return extractTextFromXmlFragment(fragment)
  } catch (err) {
    console.error('[Hocuspocus] extractPlainText error:', err)
    return ''
  }
}

function extractTextFromXmlFragment(element: Y.XmlFragment | Y.XmlElement): string {
  const texts: string[] = []
  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      texts.push(child.toString())
    } else if (child instanceof Y.XmlElement) {
      const childText = extractTextFromXmlFragment(child)
      if (childText) texts.push(childText)
      if (['paragraph', 'heading'].includes(child.nodeName)) texts.push('\n')
    }
  })
  return texts.join('').trim()
}

export function startHocuspocus() {
  const server = Server.configure({
    port: env.HOCUSPOCUS_PORT,

    async onAuthenticate({ token, documentName }: any) {
      console.log(`[Hocuspocus] Client authenticating for: ${documentName}`)

      if (env.NODE_ENV !== 'production' && token === 'dev-token') {
        return {
          user: { id: `dev-${Date.now()}`, name: 'Dev User', color: '#6366f1' },
        }
      }

      if (!token) throw new Error('Authentication required')

      const user = authService.getUserFromToken(token)
      if (!user) throw new Error('Authentication failed')

      return {
        user: { id: user.id, name: user.name, color: user.color },
      }
    },

    async onChange({ documentName, document }: any) {
      // 1. Skip Vault documents
      const result = await db.select({ isVault: documents.isVault })
        .from(documents)
        .where(eq(documents.id, documentName))
        .limit(1)

      if (result[0]?.isVault) return

      // 2. Distributed Debouncing
      const plainText = extractPlainText(document)
      if (plainText.length > 20) {
        await debouncedIndexDocument(documentName, plainText)
      }
    },

    extensions: [
      // 1. Persistence Layer
      new Database({
        fetch: async ({ documentName }) => {
          try {
            const result = await db.select().from(documents).where(eq(documents.id, documentName)).limit(1)
            if (result.length > 0 && result[0].content) return result[0].content
            await db.insert(documents).values({ id: documentName, title: 'Untitled' }).onConflictDoNothing()
            return null
          } catch (err) {
            console.error(`[Hocuspocus] Fetch error:`, err)
            return null
          }
        },
        store: async ({ documentName, state }) => {
          try {
            await db.update(documents).set({ content: Buffer.from(state), updatedAt: new Date() }).where(eq(documents.id, documentName))
          } catch (err) {
            console.error(`[Hocuspocus] Store error:`, err)
          }
        },
      }),

      // 2. Scalability Layer (Redis Clustering)
      new Redis({
        host: new URL(env.REDIS_URL).hostname || 'localhost',
        port: parseInt(new URL(env.REDIS_URL).port, 10) || 6379,
      }),
    ],
  })

  server.listen()
  console.log(`[Hocuspocus] Server running on port ${env.HOCUSPOCUS_PORT}`)
}

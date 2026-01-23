import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { eq } from 'drizzle-orm'
import * as Y from 'yjs'
import { addRagIndexJob } from '../queue/queue.module'
import { documents } from '@nexusnote/db'
import { db } from '../database/database.module'
import { env } from '../config/env.config'
import { AuthService } from '../auth/auth.service'

// Auth service instance for JWT verification
const authService = new AuthService()

// 防抖器 - 用于 RAG 索引
const debounceTimers = new Map<string, NodeJS.Timeout>()

function debouncedIndexDocument(documentName: string, plainText: string) {
  const existing = debounceTimers.get(documentName)
  if (existing) {
    clearTimeout(existing)
  }

  // 10秒后触发索引
  const timer = setTimeout(async () => {
    console.log(`[Hocuspocus] Queueing RAG index for: ${documentName}`)

    try {
      // 更新纯文本字段
      await db.update(documents)
        .set({ plainText, updatedAt: new Date() })
        .where(eq(documents.id, documentName))

      // 推入 BullMQ 队列
      await addRagIndexJob({ documentId: documentName, plainText })
    } catch (err) {
      console.error(`[Hocuspocus] Failed to queue RAG index:`, err)
    }

    debounceTimers.delete(documentName)
  }, 10000) // 10秒防抖

  debounceTimers.set(documentName, timer)
}

// 从 Yjs Doc 提取纯文本（服务器端，无 DOM）
function extractPlainText(ydoc: Y.Doc): string {
  try {
    // Tiptap 使用 'default' fragment
    const fragment = ydoc.getXmlFragment('default')
    return extractTextFromXmlFragment(fragment)
  } catch (err) {
    console.error('[Hocuspocus] extractPlainText error:', err)
    return ''
  }
}

// 递归提取 Yjs XmlFragment 中的文本
function extractTextFromXmlFragment(element: Y.XmlFragment | Y.XmlElement): string {
  const texts: string[] = []

  element.forEach((child) => {
    if (child instanceof Y.XmlText) {
      texts.push(child.toString())
    } else if (child instanceof Y.XmlElement) {
      const childText = extractTextFromXmlFragment(child)
      if (childText) {
        texts.push(childText)
      }
      // 段落和标题后添加换行
      if (['paragraph', 'heading'].includes(child.nodeName)) {
        texts.push('\n')
      }
    }
  })

  return texts.join('').trim()
}

export function startHocuspocus() {
  const server = Server.configure({
    port: env.HOCUSPOCUS_PORT,

    // 鉴权
    async onAuthenticate({ token, documentName }) {
      console.log(`[Hocuspocus] Client authenticating for: ${documentName}`)

      // In development mode, allow dev-token for testing
      if (env.NODE_ENV !== 'production' && token === 'dev-token') {
        console.log('[Hocuspocus] Using dev token (development mode)')
        return {
          user: {
            id: `dev-${Date.now()}`,
            name: 'Dev User',
            color: '#6366f1',
          },
        }
      }

      // Verify JWT token
      if (!token) {
        throw new Error('Authentication required: no token provided')
      }

      const user = authService.getUserFromToken(token)
      if (!user) {
        throw new Error('Authentication failed: invalid or expired token')
      }

      console.log(`[Hocuspocus] Authenticated user: ${user.name} (${user.id})`)
      return {
        user: {
          id: user.id,
          name: user.name,
          color: user.color,
        },
      }
    },

    // 连接建立
    async onConnect({ documentName }) {
      console.log(`[Hocuspocus] Connected: ${documentName}`)
    },

    // 断开连接
    async onDisconnect({ documentName }) {
      console.log(`[Hocuspocus] Disconnected: ${documentName}`)
    },

    // 文档变更 - 触发 RAG 索引队列（10秒防抖）
    async onChange({ documentName, document }) {
      const plainText = extractPlainText(document)
      if (plainText.length > 20) {
        debouncedIndexDocument(documentName, plainText)
      }
    },

    // 数据库持久化扩展
    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          console.log(`[Hocuspocus] Fetching document: ${documentName}`)

          try {
            const result = await db.select()
              .from(documents)
              .where(eq(documents.id, documentName))
              .limit(1)

            if (result.length > 0 && result[0].content) {
              console.log(`[Hocuspocus] Found existing document: ${documentName}`)
              return result[0].content
            }

            // 文档不存在，创建新文档
            console.log(`[Hocuspocus] Creating new document: ${documentName}`)
            await db.insert(documents).values({
              id: documentName,
              title: 'Untitled',
            }).onConflictDoNothing()

            return null
          } catch (err) {
            console.error(`[Hocuspocus] Fetch error:`, err)
            return null
          }
        },

        store: async ({ documentName, state }) => {
          console.log(`[Hocuspocus] Storing document: ${documentName} (${state.length} bytes)`)

          try {
            const result = await db.update(documents)
              .set({
                content: Buffer.from(state),
                updatedAt: new Date(),
              })
              .where(eq(documents.id, documentName))
              .returning()

            if (result.length === 0) {
              await db.insert(documents).values({
                id: documentName,
                title: 'Untitled',
                content: Buffer.from(state),
              })
            }

            console.log(`[Hocuspocus] Document saved: ${documentName}`)
          } catch (err) {
            console.error(`[Hocuspocus] Store error:`, err)
          }
        },
      }),
    ],
  })

  server.listen()
  console.log(`[Hocuspocus] Collaboration server running on ws://localhost:${env.HOCUSPOCUS_PORT}`)
}

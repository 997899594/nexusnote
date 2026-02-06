/**
 * Notes Extract API
 *
 * 提取笔记并存储到 extractedNotes 表
 * 异步生成嵌入并分类到主题
 */

import { auth } from '@/auth'
import { db, extractedNotes } from '@nexusnote/db'
import { checkRateLimit, createRateLimitResponse } from '@/lib/ai/rate-limit'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { env } from '@nexusnote/config'

export const runtime = 'nodejs'

// Redis 连接（复用现有配置）
const redis = new IORedis(env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// 笔记分类队列
const noteClassifyQueue = new Queue('note-classify', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export async function POST(req: Request) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 速率限制
    const rateLimitResult = await checkRateLimit(session.user.id)
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.resetAt)
    }

    // 3. 解析请求
    const {
      content,
      sourceType,
      sourceDocumentId,
      sourceChapterId,
      sourcePosition,
    } = await req.json()

    if (!content || typeof content !== 'string') {
      return Response.json(
        { error: 'Missing or invalid content' },
        { status: 400 }
      )
    }

    // 4. 创建笔记记录
    const [note] = await db.insert(extractedNotes).values({
      userId: session.user.id,
      content: content.slice(0, 2000), // 限制长度
      sourceType: sourceType || 'document',
      sourceDocumentId,
      sourceChapterId,
      sourcePosition,
      status: 'processing',
    }).returning({ id: extractedNotes.id })

    // 5. 异步生成嵌入并分类到主题
    await noteClassifyQueue.add('classify', {
      noteId: note.id,
      userId: session.user.id,
      content: content.slice(0, 2000),
    })

    return Response.json({ noteId: note.id })
  } catch (error) {
    console.error('[Extract API] Error:', error)
    return Response.json(
      {
        error: 'Extract failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

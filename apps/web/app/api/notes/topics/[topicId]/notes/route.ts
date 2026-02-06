/**
 * Topic Notes API - Fullstack Implementation
 *
 * 获取特定 Topic 下的所有 ExtractedNotes
 * 直接查询数据库，不再代理外部 API
 */

import { auth } from '@/auth'
import { db, extractedNotes, eq, and } from '@nexusnote/db'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    // 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized', notes: [] }, { status: 401 })
    }

    const { topicId } = await params

    if (!topicId) {
      return Response.json({ error: 'topicId is required', notes: [] }, { status: 400 })
    }

    // 直接从数据库查询该 topic 下的所有 notes
    // 确保只查询用户自己的笔记
    const topicNotes = await db
      .select()
      .from(extractedNotes)
      .where(
        and(
          eq(extractedNotes.topicId, topicId),
          eq(extractedNotes.userId, session.user.id)
        )
      )
      .orderBy(extractedNotes.createdAt)

    return Response.json(topicNotes)
  } catch (err) {
    console.error('[Topic Notes API] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message, notes: [] }, { status: 500 })
  }
}

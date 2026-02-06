import { streamObject } from 'ai'
import { chatModel, isAIConfigured } from '@/lib/ai/registry'
import { z } from 'zod'
import { auth } from '@/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

const ChapterSchema = z.object({
  title: z.string().describe('章节标题'),
  content: z.string().describe('章节简要说明（2-3句话）'),
  level: z.number().min(1).max(3).describe('章节层级'),
})

const DocumentSchema = z.object({
  outline: z.array(ChapterSchema).describe('文档章节列表'),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 速率限制
  const rateLimitResult = await checkRateLimit(session.user.id)
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetAt)
  }

  const { topic, depth = 'medium' } = await req.json()

  if (!topic) {
    return Response.json({ error: 'Topic is required' }, { status: 400 })
  }

  if (!isAIConfigured() || !chatModel) {
    return Response.json({ error: 'AI not configured' }, { status: 500 })
  }

  const validDepth = (d: string): 'shallow' | 'medium' | 'deep' => {
    return ['shallow', 'medium', 'deep'].includes(d) ? (d as 'shallow' | 'medium' | 'deep') : 'medium'
  }

  const depthConfig = {
    shallow: { chapters: 3, detail: '简要' },
    medium: { chapters: 5, detail: '适中' },
    deep: { chapters: 8, detail: '详细' },
  }[validDepth(depth)]

  const result = streamObject({
    model: chatModel!,
    system: `你是一个技术文档写作专家。根据用户提供的主题生成结构化的文档大纲。

## 输出要求
1. 生成 ${depthConfig.chapters} 个主要章节
2. 每个章节包含标题和简要说明（${depthConfig.detail}）
3. 使用层级结构（level 1-3）`,
    prompt: `主题：${topic}\n\n请生成文档大纲。`,
    schema: DocumentSchema,
  })

  return result.toTextStreamResponse()
}

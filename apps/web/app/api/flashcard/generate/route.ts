import { generateText } from 'ai'
import { fastModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry'
import { auth } from '@/auth'
import { checkRateLimit, createRateLimitResponse } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `你是一个间隔重复学习(SRS)卡片生成助手。用户会提供一个问题或概念，你需要生成一个简洁、准确的答案。

答案要求：
1. 简洁明了，便于记忆
2. 直接回答问题核心
3. 如果有公式或代码，用简洁的格式
4. 避免冗余信息`

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

  const { question, context } = await req.json()

  if (!question) {
    return Response.json({ error: 'Question is required' }, { status: 400 })
  }

  if (!isAIConfigured() || !fastModel) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    )
  }

  const userPrompt = context
    ? `问题: ${question}\n\n上下文: ${context}\n\n请生成简洁的答案：`
    : `问题: ${question}\n\n请生成简洁的答案：`

  try {
    const result = await generateText({
      model: fastModel!,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 500,
      temperature: 0.5,
    })

    return Response.json({ answer: result.text.trim() })
  } catch (err) {
    console.error('[Flashcard Generate] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Generation failed: ${message}` }, { status: 500 })
  }
}

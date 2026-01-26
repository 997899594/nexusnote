import { generateText } from 'ai'
import { fastModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `你是一个间隔重复学习(SRS)卡片生成助手。用户会提供一个问题或概念，你需要生成一个简洁、准确的答案。

答案要求：
1. 简洁明了，便于记忆
2. 直接回答问题核心
3. 如果有公式或代码，用简洁的格式
4. 避免冗余信息`

export async function POST(req: Request) {
  const { question, context } = await req.json()

  if (!question) {
    return new Response(JSON.stringify({ error: 'Question is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isAIConfigured() || !fastModel) {
    const info = getAIProviderInfo()
    return new Response(JSON.stringify({ error: `AI API key not configured. Provider: ${info.provider}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
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

    return new Response(JSON.stringify({ answer: result.text.trim() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[Flashcard Generate] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: `Generation failed: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

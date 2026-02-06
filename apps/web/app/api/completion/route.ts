import { streamText } from 'ai'
import { fastModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry'
import { auth } from '@/auth'
import { createTelemetryConfig } from '@/lib/ai/langfuse'
import { checkRateLimit, createRateLimitResponse } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30 // 写作辅助通常较快

const PROMPTS: Record<string, string> = {
  continue: '请继续写作以下内容，保持风格一致，自然衔接：\n\n',
  improve: '请润色以下文本，提升表达质量，保持原意：\n\n',
  shorter: '请缩写以下内容，保留关键信息，更加简洁：\n\n',
  longer: '请扩展以下内容，增加细节 and 深度：\n\n',
  translate_en: '请将以下内容翻译成英文：\n\n',
  translate_zh: '请将以下内容翻译成中文：\n\n',
  fix: '请修正以下文本的拼写和语法错误，保持原意：\n\n',
  explain: '请解释以下内容，用简单易懂的语言：\n\n',
  summarize: '请总结以下内容的要点：\n\n',
}

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

  const { prompt, action, selection } = await req.json()

  if (!isAIConfigured() || !fastModel) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    )
  }

  const instruction = PROMPTS[action as keyof typeof PROMPTS] || ''
  const fullPrompt = instruction + (selection || prompt)

  try {
    const result = streamText({
      model: fastModel!,
      prompt: fullPrompt,
      maxOutputTokens: 2048,
      temperature: 0.7,
      // AI SDK v6 Native Features (2026)
      maxRetries: 3,
      onFinish: ({ usage, finishReason }) => {
        if (usage?.totalTokens) {
          const cost = (usage.totalTokens / 1000000) * 0.1;
          console.log(`[Completion] Action: ${action}, Tokens: ${usage.totalTokens}, Cost: $${cost.toFixed(4)}, Reason: ${finishReason}`);
        }
      },
      // Langfuse Observability (2026)
      experimental_telemetry: createTelemetryConfig('editor-completion', {
        action: action as string,
        userId: session.user?.id || 'anonymous',
      }),
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[Completion] Stream error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Completion failed: ${message}` }, { status: 500 })
  }
}

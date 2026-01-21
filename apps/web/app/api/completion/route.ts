import { streamText } from 'ai'
import { chatModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai'

export const runtime = 'nodejs'

const PROMPTS: Record<string, string> = {
  continue: '请继续写作以下内容，保持风格一致，自然衔接：\n\n',
  improve: '请润色以下文本，提升表达质量，保持原意：\n\n',
  shorter: '请缩写以下内容，保留关键信息，更加简洁：\n\n',
  longer: '请扩展以下内容，增加细节和深度：\n\n',
  translate_en: '请将以下内容翻译成英文：\n\n',
  translate_zh: '请将以下内容翻译成中文：\n\n',
  fix: '请修正以下文本的拼写和语法错误，保持原意：\n\n',
  explain: '请解释以下内容，用简单易懂的语言：\n\n',
  summarize: '请总结以下内容的要点：\n\n',
}

export async function POST(req: Request) {
  const { prompt, action, selection } = await req.json()

  if (!isAIConfigured()) {
    const { provider } = getAIProviderInfo()
    return new Response(JSON.stringify({ error: `AI API key not configured for provider: ${provider}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const instruction = PROMPTS[action as keyof typeof PROMPTS] || ''
  const fullPrompt = instruction + (selection || prompt)

  try {
    const result = streamText({
      model: chatModel,
      prompt: fullPrompt,
      maxOutputTokens: 2048,
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[Completion] Stream error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: `Completion failed: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

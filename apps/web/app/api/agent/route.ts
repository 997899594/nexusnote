import { generateText } from 'ai'
import { chatModel, isAIConfigured } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Agent API Route
 * 
 * 让 Agent 通过服务端调用 AI，避免暴露 API Key 到客户端
 * 
 * 支持两种模式：
 * 1. generateText - 用于 planning, reflection, synthesis
 * 2. streamText - 用于实时对话（未来扩展）
 */
export async function POST(req: Request) {
  try {
    const { 
      messages, 
      system,
      prompt,
      temperature = 0.7,
      mode = 'generate' // 'generate' | 'stream'
    } = await req.json()

    if (!isAIConfigured()) {
      return new Response(
        JSON.stringify({ error: 'AI model not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 模式 1: generateText（用于 Agent 的 plan/reflect/synthesize）
    if (mode === 'generate') {
      const { text } = await generateText({
        model: chatModel,
        system,
        prompt,
        messages,
        temperature,
      })

      return new Response(
        JSON.stringify({ text }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 模式 2: streamText（未来扩展）
    // const result = streamText({ ... })
    // return result.toDataStreamResponse()

    return new Response(
      JSON.stringify({ error: 'Invalid mode' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Agent API] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

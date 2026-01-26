import { generateText, stepCountIs } from 'ai'
import { chatModel, isAIConfigured } from '@/lib/ai'
import { toolRegistry } from '@/lib/agents/tools'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Agent API Route
 * 
 * 让 Agent 通过服务端调用 AI，避免暴露 API Key 到客户端
 * 支持原生 Function Calling
 */
export async function POST(req: Request) {
  try {
    const { 
      messages, 
      system,
      prompt,
      temperature = 0.7,
      tools: toolNames,  // 工具名称列表
      maxSteps = 5,      // 最大工具调用步数
    } = await req.json()

    if (!isAIConfigured()) {
      return new Response(
        JSON.stringify({ error: 'AI model not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 转换工具为 AI SDK 格式
    const tools = toolNames ? toolRegistry.toAISDKTools(toolNames) : undefined

    // 使用 generateText 支持 Function Calling
    const result = await generateText({
      model: chatModel,
      system,
      prompt,
      messages,
      temperature,
      tools,
      stopWhen: stepCountIs(maxSteps),  // 控制最大步数
    })

    return new Response(
      JSON.stringify({ 
        text: result.text,
        toolCalls: result.toolResults?.map((tr: any) => ({
          toolName: tr.toolName,
          args: tr.args,
          result: tr.result,
        })),
        finishReason: result.finishReason,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
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

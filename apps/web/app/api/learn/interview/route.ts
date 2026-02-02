import { createAgentUIStreamResponse, smoothStream } from 'ai'
import { isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry'
import { interviewAgent, type InterviewCallOptions } from '@/lib/ai/agents'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, phase, currentOutline, goal, currentProfile } = await req.json()

  if (!messages || !Array.isArray(messages)) {
    return Response.json(
      { error: 'Messages array is required' },
      { status: 400 },
    )
  }

  if (!isAIConfigured()) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    )
  }

  const callOptions: InterviewCallOptions = {
    phase,
    currentOutline,
    goal,
    currentProfile,
  }

  try {
    return await createAgentUIStreamResponse({
      agent: interviewAgent,
      uiMessages: messages,
      options: callOptions,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter('zh-Hans', { granularity: 'word' }),
      }),
    })
  } catch (error) {
    console.error('Interview API Error:', error)
    return Response.json(
      { error: 'Failed to generate interview response' },
      { status: 500 },
    )
  }
}

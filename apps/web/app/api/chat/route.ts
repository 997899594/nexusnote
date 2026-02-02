import { createAgentUIStreamResponse, smoothStream } from 'ai'
import { isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry'
import { chatAgent, webSearchChatAgent, type ChatCallOptions } from '@/lib/ai/agents'
import { ragService } from '@/lib/ai/rag'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

interface MessagePart {
  type: string
  text?: string
  [key: string]: unknown
}

interface ChatMessage {
  role: string
  parts?: MessagePart[]
  [key: string]: unknown
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    messages,
    enableRAG = false,
    enableTools = true,
    enableWebSearch = false,
    documentContext,
    documentStructure,
    editMode = false,
  } = await req.json()

  if (!isAIConfigured()) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    )
  }

  // RAG 上下文预获取
  let ragContext: string | undefined
  let ragSources: Array<{ documentId: string; title: string }> | undefined

  if (enableRAG) {
    const lastUserMsg = (messages as ChatMessage[])
      .filter((m) => m.role === 'user')
      .pop()
    const query = lastUserMsg?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('') || ''

    if (query) {
      const result = await ragService.search(query, session.user!.id!)
      ragContext = result.context
      ragSources = result.sources
    }
  }

  // 构造 callOptions，传给 Agent 的 prepareCall
  const callOptions: ChatCallOptions = {
    ragContext,
    ragSources,
    documentContext,
    documentStructure,
    editMode,
    enableTools,
    enableWebSearch,
  }

  // 选择 Agent：启用联网搜索时使用 webSearchChatAgent
  const selectedAgent = (enableWebSearch && webSearchChatAgent) ? webSearchChatAgent : chatAgent

  try {
    return await createAgentUIStreamResponse({
      agent: selectedAgent,
      uiMessages: messages,
      options: callOptions,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter('zh-Hans', { granularity: 'word' }),
      }),
    })
  } catch (err) {
    console.error('[Chat] Agent error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Chat failed: ${message}` }, { status: 500 })
  }
}

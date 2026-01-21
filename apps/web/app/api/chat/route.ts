import { streamText } from 'ai'
import { chatModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai'

export const runtime = 'nodejs'

// 配置
const RAG_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const RAG_TIMEOUT = 5000 // 5秒超时
const RAG_RETRIES = 2    // 最多重试2次
const SIMILARITY_THRESHOLD = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.3')

// 带超时的 fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// 带重试的 RAG 检索
async function retrieveContext(
  query: string,
  retries = RAG_RETRIES
): Promise<{ context: string; sources: Array<{ documentId: string; title: string }> }> {
  const emptyResult = { context: '', sources: [] }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${RAG_API_URL}/rag/search?q=${encodeURIComponent(query)}&topK=5`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        RAG_TIMEOUT
      )

      if (!response.ok) {
        console.error(`[RAG] Search failed (attempt ${attempt + 1}):`, response.status)
        if (attempt < retries) continue
        return emptyResult
      }

      const results = await response.json() as Array<{
        content: string
        documentId: string
        documentTitle: string
        similarity: number
      }>

      if (results.length === 0) return emptyResult

      const relevant = results.filter(r => r.similarity > SIMILARITY_THRESHOLD)
      if (relevant.length === 0) return emptyResult

      const context = relevant
        .map((r, i) => `[${i + 1}] ${r.content}`)
        .join('\n\n---\n\n')

      const sources = [...new Map(
        relevant.map(r => [r.documentId, { documentId: r.documentId, title: r.documentTitle }])
      ).values()]

      return { context, sources }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      console.error(`[RAG] ${isTimeout ? 'Timeout' : 'Error'} (attempt ${attempt + 1}):`, err)
      if (attempt >= retries) return emptyResult
    }
  }

  return emptyResult
}

// AI SDK 3.x 消息格式: parts[] → content string
function normalizeMessages(messages: any[]): Array<{ role: string; content: string }> {
  return messages.map(m => ({
    role: m.role,
    content: m.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('') || ''
  }))
}

export async function POST(req: Request) {
  const { messages: rawMessages, enableRAG = false, documentContext } = await req.json()
  const messages = normalizeMessages(rawMessages || [])

  // 检查 API Key
  if (!isAIConfigured()) {
    const { provider } = getAIProviderInfo()
    return new Response(JSON.stringify({ error: `AI API key not configured for provider: ${provider}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let systemPrompt = ''
  let ragSources: Array<{ documentId: string; title: string }> = []

  if (enableRAG) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
    const { context, sources } = await retrieveContext(lastUserMessage)
    ragSources = sources

    if (context) {
      systemPrompt = `你是 NexusNote 知识库助手。请根据以下知识库内容回答用户问题。

## 知识库内容
${context}

## 回答规则
1. 优先使用知识库中的信息回答
2. 如果知识库中没有相关信息，可以使用你的通用知识，但需说明
3. 引用知识库内容时，使用 [1], [2] 等标记
4. 保持回答简洁、专业`
    } else {
      systemPrompt = `你是 NexusNote 知识库助手。用户启用了知识库检索，但未找到相关内容。请基于通用知识回答。`
    }
  } else if (documentContext) {
    systemPrompt = `你是 NexusNote 知识库助手。当前文档内容如下：

${documentContext}

请基于上述文档内容回答用户问题。`
  } else {
    systemPrompt = `你是 NexusNote 知识库助手，帮助用户进行写作、整理知识和回答问题。

你可以：
- 帮助用户润色、扩写、缩写文本
- 回答关于写作和知识管理的问题
- 提供创意建议和头脑风暴
- 解释复杂概念

请用简洁、专业的方式回答。`
  }

  // 如果有 RAG sources，在 system prompt 末尾添加
  if (ragSources.length > 0) {
    systemPrompt += `\n\n---\n参考来源：${ragSources.map(s => s.title).join(', ')}`
  }

  try {
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages,
      maxOutputTokens: 4096,
      temperature: 0.7,
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('[Chat] Stream error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: `Chat failed: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

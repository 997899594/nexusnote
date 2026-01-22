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

// AI SDK 6.x 消息格式: parts[] → content string
function normalizeMessages(messages: any[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('') || ''
    }))
}

export async function POST(req: Request) {
  const {
    messages: rawMessages,
    enableRAG = false,
    documentContext,
    documentStructure,  // Phase 2: 文档结构 (用于编辑模式)
    editMode = false,   // Phase 2: 是否为编辑模式
  } = await req.json()
  const messages = normalizeMessages(rawMessages || [])

  // Debug: 检查收到的参数
  console.log('[Chat API] enableRAG:', enableRAG, '| documentContext:', documentContext ? `${documentContext.slice(0, 50)}...` : 'NONE', '| editMode:', editMode)

  // 检查 API Key
  if (!isAIConfigured()) {
    const info = getAIProviderInfo()
    return new Response(JSON.stringify({ error: `AI API key not configured. Provider: ${info.chat.provider}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let systemPrompt = ''
  let ragSources: Array<{ documentId: string; title: string }> = []
  let ragContext = ''

  // 1. 如果启用 RAG，先获取知识库上下文
  if (enableRAG) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
    const { context, sources } = await retrieveContext(lastUserMessage)
    ragContext = context
    ragSources = sources
  }

  // 2. 构建 system prompt，同时支持当前文档 + 知识库
  if (documentContext && ragContext) {
    // 两者都有
    systemPrompt = `你是 NexusNote 知识库助手。

## 当前文档内容
${documentContext}

## 知识库相关内容
${ragContext}

## 回答规则
1. 如果用户问的是当前文档相关的问题，优先基于"当前文档内容"回答
2. 如果需要补充信息，可以参考"知识库相关内容"
3. 引用知识库内容时，使用 [1], [2] 等标记
4. 保持回答简洁、专业`
  } else if (documentContext) {
    // 仅当前文档
    if (editMode && documentStructure) {
      // 编辑模式：AI 需要返回结构化的编辑指令
      systemPrompt = `你是 NexusNote 文档编辑助手。

## 当前文档结构
${documentStructure}

## 当前文档内容
${documentContext}

## 你的任务
用户会请求修改文档。你需要：
1. 理解用户的编辑意图（润色、改写、扩写、缩写、翻译、重写等）
2. 判断编辑范围：
   - 如果是修改特定部分（如"第一段"、"标题"），使用 replace 并指定目标块
   - 如果是全文重写/生成新文章/删除全部重写，使用 replace_all
   - 如果需要修改多个部分，输出多个编辑块
3. 生成修改后的新内容

## 响应格式
### 单块编辑（修改特定部分）
<<<EDIT_START>>>
TARGET: [目标块ID，如 p-0, h-1 等]
ACTION: [replace/insert_after/insert_before/delete]
CONTENT:
[修改后的新内容]
<<<EDIT_END>>>

### 全文替换（重写整篇文章）
<<<EDIT_START>>>
TARGET: document
ACTION: replace_all
CONTENT:
[完整的新文章内容，使用 Markdown 格式]
<<<EDIT_END>>>

### 多块编辑（同时修改多处）
可以输出多个 <<<EDIT_START>>>...<<<EDIT_END>>> 块

解释：[简要说明你做了什么修改]

## 示例1：修改单段
用户：把第一段改成更正式的语气
<<<EDIT_START>>>
TARGET: p-0
ACTION: replace
CONTENT:
本文旨在探讨人工智能技术在现代企业管理中的应用价值与实践路径。
<<<EDIT_END>>>

解释：将第一段改写为更正式的学术语气。

## 示例2：全文重写
用户：删掉这些内容，帮我写一篇关于春天的作文
<<<EDIT_START>>>
TARGET: document
ACTION: replace_all
CONTENT:
# 春天的脚步

春天悄然而至，万物复苏...

（完整的作文内容）
<<<EDIT_END>>>

解释：已生成一篇关于春天的作文，替换原有内容。

## 示例3：多处修改
用户：把标题改好听点，然后把第一段扩写
<<<EDIT_START>>>
TARGET: h-0
ACTION: replace
CONTENT:
探索知识的边界
<<<EDIT_END>>>

<<<EDIT_START>>>
TARGET: p-0
ACTION: replace
CONTENT:
知识的海洋浩瀚无垠...（扩写后的内容）
<<<EDIT_END>>>

解释：更新了标题并扩写了第一段。

## 注意
- 如果用户只是提问而不是请求编辑，正常回答即可
- 当用户说"删掉全部"、"重新写"、"写一篇新的"时，使用 replace_all
- 使用 Markdown 格式书写新内容（标题用 #，列表用 -，等等）
- 保持修改后的内容风格与用户要求一致`
    } else {
      systemPrompt = `你是 NexusNote 知识库助手。当前文档内容如下：

${documentContext}

请基于上述文档内容回答用户问题。如果问题与文档无关，可以使用通用知识回答。`
    }
  } else if (ragContext) {
    // 仅知识库 RAG
    systemPrompt = `你是 NexusNote 知识库助手。请根据以下知识库内容回答用户问题。

## 知识库内容
${ragContext}

## 回答规则
1. 优先使用知识库中的信息回答
2. 如果知识库中没有相关信息，可以使用你的通用知识，但需说明
3. 引用知识库内容时，使用 [1], [2] 等标记
4. 保持回答简洁、专业`
  } else if (enableRAG) {
    // 启用了 RAG 但没有找到相关内容
    systemPrompt = `你是 NexusNote 知识库助手。用户启用了知识库检索，但未找到相关内容。请基于通用知识回答。`
  } else {
    // 默认模式
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

import { streamText } from 'ai'
import { chatModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai'
import { skills } from '@/lib/ai/skills'
import { API_URL, config } from '@/lib/config'

export const runtime = 'nodejs'
export const maxDuration = 60

// 使用集中配置
const RAG_API_URL = API_URL
const RAG_TIMEOUT = config.rag.timeout
const RAG_RETRIES = config.rag.retries
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
    enableTools = true,  // 新增：是否启用工具调用
    documentContext,
    documentStructure,
    editMode = false,
  } = await req.json()
  const messages = normalizeMessages(rawMessages || [])

  console.log('[Chat API] enableRAG:', enableRAG, '| enableTools:', enableTools, '| editMode:', editMode)

  // 检查 API Key
  if (!isAIConfigured() || !chatModel) {
    const info = getAIProviderInfo()
    return new Response(JSON.stringify({ error: `AI API key not configured. Provider: ${info.provider}` }), {
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

  // 2. 构建 system prompt
  if (documentContext && ragContext) {
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
    if (editMode && documentStructure) {
      systemPrompt = `你是 NexusNote 文档编辑助手。

## 当前文档结构
${documentStructure}

## 当前文档内容
${documentContext}

## 你的任务
用户会请求修改文档。你需要：
1. 理解用户的编辑意图
2. 判断编辑范围
3. 生成修改后的新内容

## 响应格式
<<<EDIT_START>>>
TARGET: [目标块ID 或 document]
ACTION: [replace/replace_all/insert_after/insert_before/delete]
CONTENT:
[修改后的内容]
<<<EDIT_END>>>

解释：[简要说明修改]

## 注意
- 如果用户只是提问而不是请求编辑，正常回答即可
- 使用 Markdown 格式书写新内容`
    } else {
      systemPrompt = `你是 NexusNote 知识库助手。当前文档内容如下：

${documentContext}

请基于上述文档内容回答用户问题。`
    }
  } else if (ragContext) {
    systemPrompt = `你是 NexusNote 知识库助手。请根据以下知识库内容回答用户问题。

## 知识库内容
${ragContext}

## 回答规则
1. 优先使用知识库中的信息回答
2. 引用知识库内容时，使用 [1], [2] 等标记`
  } else {
    // 默认模式 - 包含工具使用说明
    systemPrompt = `你是 NexusNote 知识库助手，帮助用户进行写作、整理知识和学习。

## 你的能力
你可以使用以下工具帮助用户：

1. **createFlashcards** - 创建闪卡
   - 当用户说"把这段做成闪卡"、"帮我记忆这些"、"创建卡片"时使用
   - 将内容拆分成问答对，生成便于记忆的卡片

2. **searchNotes** - 搜索笔记
   - 当用户问"我之前写过什么关于..."、"搜索我的笔记"时使用
   - 在知识库中查找相关内容

3. **getReviewStats** - 获取学习统计
   - 当用户问"我的学习进度"、"今天要复习多少"时使用
   - 显示闪卡复习数据

4. **createLearningPlan** - 生成学习计划
   - 当用户说"帮我制定学习计划"、"规划一下学习"时使用
   - 根据主题生成结构化的学习计划

## 回答规则
1. 主动识别用户意图，适时调用工具
2. 工具调用后，基于结果给出友好的总结
3. 保持回答简洁、有帮助`
  }

  if (ragSources.length > 0) {
    systemPrompt += `\n\n---\n参考来源：${ragSources.map(s => s.title).join(', ')}`
  }

  try {
    const result = streamText({
      model: chatModel!,
      system: systemPrompt,
      messages,
      maxOutputTokens: 4096,
      temperature: 0.7,
      // 启用工具调用
      ...(enableTools && !editMode ? {
        tools: skills,
        maxSteps: 3, // 允许多轮工具调用
      } : {}),
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

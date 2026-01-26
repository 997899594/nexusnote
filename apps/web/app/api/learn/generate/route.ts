import { generateText } from 'ai'
import { z } from 'zod'
import { chatModel, webSearchModel, isAIConfigured, isWebSearchAvailable, getAIProviderInfo } from '@/lib/ai'

export const runtime = 'nodejs'

// Course outline schema for validation
const CourseOutlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedMinutes: z.number(),
  chapters: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    keyPoints: z.array(z.string()),
  })),
})

export async function POST(req: Request) {
  const { goal } = await req.json()

  if (!goal || typeof goal !== 'string') {
    return Response.json({ error: 'Missing learning goal' }, { status: 400 })
  }

  if (!isAIConfigured() || (!webSearchModel && !chatModel)) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 }
    )
  }

  try {
    // 优先使用联网模型获取最新知识，否则使用普通模型
    const model = (webSearchModel ?? chatModel)!
    const useWebSearch = isWebSearchAvailable()

    console.log(`[Learn Generate] Using ${useWebSearch ? 'web search' : 'standard'} model`)

    // 使用 generateText + JSON 解析，兼容 DeepSeek
    const { text } = await generateText({
      model,
      prompt: `你是一位资深教育专家，擅长设计结构清晰、循序渐进的学习课程。
${useWebSearch ? '你可以联网搜索最新资料，请确保内容是 2025-2026 年最新的。\n' : ''}
用户的学习目标：${goal}

请设计一个完整的学习课程大纲，**必须以 JSON 格式输出**，结构如下：

{
  "title": "课程标题",
  "description": "课程简介，说明学完能达到什么水平",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedMinutes": 预计完成时间（分钟，数字）,
  "chapters": [
    {
      "title": "章节标题",
      "summary": "章节简介",
      "keyPoints": ["要点1", "要点2", "要点3"]
    }
  ]
}

要求：
1. 6-12 个章节，从基础到进阶
2. 每章 3-5 个关键要点
3. 必须是合法的 JSON，不要添加额外说明文字

请直接输出 JSON：`,
      temperature: 0.7,
    })

    // 提取 JSON（处理可能的 markdown 代码块）
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    // 解析并验证
    const parsed = JSON.parse(jsonStr)
    const outline = CourseOutlineSchema.parse(parsed)

    return Response.json(outline)
  } catch (error) {
    console.error('[Learn Generate] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Course generation failed: ${message}` }, { status: 500 })
  }
}

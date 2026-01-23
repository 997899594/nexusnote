import { generateObject } from 'ai'
import { z } from 'zod'
import { chatModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai'

export const runtime = 'nodejs'

// Course outline schema
const CourseOutlineSchema = z.object({
  title: z.string().describe('课程标题，简洁明了'),
  description: z.string().describe('课程简介，说明学完能达到什么水平'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).describe('难度等级'),
  estimatedMinutes: z.number().describe('预计完成时间（分钟）'),
  chapters: z.array(z.object({
    title: z.string().describe('章节标题'),
    summary: z.string().describe('章节简介'),
    keyPoints: z.array(z.string()).describe('本章要点，3-5个'),
  })).describe('课程章节，6-12章'),
})

export async function POST(req: Request) {
  const { goal } = await req.json()

  if (!goal || typeof goal !== 'string') {
    return Response.json({ error: 'Missing learning goal' }, { status: 400 })
  }

  if (!isAIConfigured()) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.chat.provider}` },
      { status: 500 }
    )
  }

  try {
    const { object: outline } = await generateObject({
      model: chatModel,
      schema: CourseOutlineSchema,
      prompt: `你是一位资深教育专家，擅长设计结构清晰、循序渐进的学习课程。

用户的学习目标：${goal}

请设计一个完整的学习课程大纲。要求：

1. **标题**：简洁有力，体现核心价值
2. **简介**：说明学完后能达到什么水平
3. **难度**：根据内容复杂度判断
4. **时长**：合理估算完成时间
5. **章节设计**：
   - 6-12 章节
   - 从基础到进阶，循序渐进
   - 每章聚焦一个核心概念或技能
   - 包含理论和实践
   - 关键要点 3-5 个

示例章节结构：
1. 入门介绍 - 建立整体认知
2. 核心概念 - 打好基础
3-7. 进阶内容 - 深入学习
8-9. 实战应用 - 动手练习
10. 高级技巧 - 提升进阶
最后. 总结回顾 - 知识整合

请用中文输出。`,
      temperature: 0.7,
    })

    return Response.json(outline)
  } catch (error) {
    console.error('[Learn Generate] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Course generation failed: ${message}` }, { status: 500 })
  }
}

import { streamText } from 'ai'
import { courseModel, isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const maxDuration = 180

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    courseTitle,
    chapterTitle,
    chapterSummary,
    keyPoints,
    chapterIndex,
    totalChapters,
    difficulty,
  } = await req.json()

  if (!courseTitle || !chapterTitle) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isAIConfigured() || !courseModel) {
    const info = getAIProviderInfo()
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 }
    )
  }

  const difficultyMap = {
    beginner: '入门级，用简单易懂的语言，多用类比和例子',
    intermediate: '中级，可以使用专业术语，深入讲解原理',
    advanced: '高级，深入技术细节，讨论边界情况和最佳实践',
  }

  const difficultyPrompt = difficultyMap[difficulty as keyof typeof difficultyMap] || difficultyMap.intermediate

  try {
    const result = streamText({
      model: courseModel!,
      prompt: `你是一位优秀的技术写作者，擅长用清晰、生动的方式讲解技术概念。

课程：${courseTitle}
当前章节：第 ${chapterIndex + 1} 章 / 共 ${totalChapters} 章
章节标题：${chapterTitle}
章节简介：${chapterSummary || '无'}
本章要点：${keyPoints?.join('、') || '无'}

难度要求：${difficultyPrompt}

请为这个章节撰写详细的教学内容。要求：

## 内容结构
1. **开篇导入**（1-2段）
   - 引出本章主题
   - 说明学完本章能收获什么

2. **核心内容**（主体部分）
   - 围绕要点展开讲解
   - 每个概念都要解释清楚
   - 适当使用代码示例、类比、图示说明
   - 循序渐进，由浅入深

3. **实践练习**（如适用）
   - 提供思考题或小练习
   - 帮助读者巩固所学

4. **本章小结**
   - 回顾要点
   - 承上启下，预告下一章

## 格式要求
- 使用 Markdown 格式
- 代码块使用适当的语言标记
- 合理使用标题层级（## 和 ###）
- 重要概念可以加粗
- 适当使用列表和表格

## 风格要求
- 像与朋友对话一样自然
- 避免说教，多启发思考
- 技术准确，表述专业
- 长度：1500-3000字

请用中文撰写完整的章节内容：`,
      temperature: 0.7,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('[Learn Generate Content] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `Content generation failed: ${message}` }, { status: 500 })
  }
}

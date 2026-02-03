import { streamText } from 'ai'
import { chatModel, isAIConfigured } from '@/lib/ai/registry'
import { auth } from '@/auth'
import { createTelemetryConfig } from '@/lib/ai/langfuse'

export const runtime = 'nodejs'
export const maxDuration = 60 // 文档分析

export async function POST(req: Request) {
    const session = await auth()
    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { context, documentTitle } = await req.json()

    if (!isAIConfigured() || !chatModel) {
        return Response.json({ error: 'AI not configured' }, { status: 500 })
    }

    const systemPrompt = `你是 NexusNote 幽灵助手。你正在观察一个用户编写文档 "${documentTitle || '无标题'}"。
用户最近似乎停顿了。观察以下上下文，判断用户是否可能处于困惑状态或者是需要一些灵感/建议。

如果用户似乎停顿在困难的地方，请提供一条简短、温和、非侵入性的建议（Ghost Comment）。
如果你觉得目前的停顿是正常的（例如用户正在思考或者已经完成了），请返回空字符串。

你的回复应该：
1. 非常简短（不超过 30 个字）。
2. 使用“协作者”或者“伙伴”的语气，而不是助手的语气。
3. 旨在打破僵局或提供新的视角。
4. **如果不需要建议，请务必返回空字符串。**

上下文内容：
---
${context}
---`

    const result = await streamText({
        model: chatModel!,
        system: systemPrompt,
        prompt: "根据上下文判断是否需要幽灵评论。如果需要，请输出建议内容。如果不需要，请输出空字符串。",
        maxOutputTokens: 100,
        temperature: 0.8,
        // AI SDK v6 Native Features (2026)
        maxRetries: 3,
        onFinish: ({ usage, finishReason }) => {
          if (usage?.totalTokens) {
            const cost = (usage.totalTokens / 1000000) * 0.1;
            console.log(`[Ghost] Tokens: ${usage.totalTokens}, Cost: $${cost.toFixed(4)}, Reason: ${finishReason}`);
          }
        },
        // Langfuse Observability (2026)
        experimental_telemetry: createTelemetryConfig('ghost-assistant', {
          documentTitle: documentTitle || 'untitled',
          userId: session.user?.id || 'anonymous',
        }),
    })

    return result.toTextStreamResponse()
}
